#include "HardwareId.hpp"

std::string cHardwareId::GetHWIDList(const std::string& url)
{
	// 1. Open Internet session
	HINTERNET hInternet = InternetOpenA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) HWIDClient/1.0", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
	if (!hInternet)
	{
		hInternet = InternetOpenA("HWIDChecker", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
		if (!hInternet) return "";
	}

	// 2. Detect HTTPS vs HTTP
	bool isHttps = (url.rfind("https://", 0) == 0);
	DWORD flags = INTERNET_FLAG_RELOAD | INTERNET_FLAG_DONT_CACHE | INTERNET_FLAG_PRAGMA_NOCACHE | INTERNET_FLAG_NO_CACHE_WRITE;

	if (isHttps)
	{
		flags |= INTERNET_FLAG_SECURE | INTERNET_FLAG_IGNORE_CERT_CN_INVALID | INTERNET_FLAG_IGNORE_CERT_DATE_INVALID;
	}

	// 3. Open URL
	HINTERNET hFile = InternetOpenUrlA(hInternet, url.c_str(), NULL, 0, flags, 0);
	if (!hFile)
	{
		// Fallback retry with reload only
		hFile = InternetOpenUrlA(hInternet, url.c_str(), NULL, 0, INTERNET_FLAG_RELOAD, 0);
		if (!hFile)
		{
			InternetCloseHandle(hInternet);
			return "";
		}
	}

	// 4. Read Response
	char buffer[4096];
	DWORD bytesRead = 0;
	std::string result = "";

	while (InternetReadFile(hFile, buffer, sizeof(buffer) - 1, &bytesRead) && bytesRead != 0)
	{
		buffer[bytesRead] = '\0';
		result.append(buffer, bytesRead);
	}

	InternetCloseHandle(hFile);
	InternetCloseHandle(hInternet);
	return result;
}

std::string cHardwareId::GetCompUserName(bool User)
{
	std::string CompUserName = "";

	char szCompName[MAX_COMPUTERNAME_LENGTH + 1];
	char szUserName[MAX_COMPUTERNAME_LENGTH + 1];

	DWORD dwCompSize = sizeof(szCompName);
	DWORD dwUserSize = sizeof(szUserName);

	if (GetComputerName(szCompName, &dwCompSize))
	{
		CompUserName = szCompName;

		if (User && GetUserName(szUserName, &dwUserSize))
		{
			CompUserName = szUserName;
		}
	}
	return CompUserName;
}

std::string cHardwareId::StringToHex(const std::string input)
{
	const char* lut = "0123456789ABCDEF";
	size_t len = input.length();
	std::string output = _T("");

	output.reserve(2 * len);

	for (size_t i = 0; i < len; i++)
	{
		const unsigned char c = input[i];
		output.push_back(lut[c >> 4]);
		output.push_back(lut[c & 15]);
	}
	return output;
}

DWORD cHardwareId::GetVolumeID()
{
	DWORD VolumeSerialNumber;
	BOOL GetVolumeInformationFlag = GetVolumeInformation("C:\\", 0, 0, (&VolumeSerialNumber), 0, 0, 0, 0);

	if (GetVolumeInformationFlag)
		return VolumeSerialNumber;

	return 0;
}

std::string cHardwareId::GetMyHWUID()
{
	HW_PROFILE_INFO hwProfileInfo;
	std::string szHwProfileGuid = "";

	if (GetCurrentHwProfile(&hwProfileInfo) != NULL)
		szHwProfileGuid = hwProfileInfo.szHwProfileGuid;

	return szHwProfileGuid;
}

std::string cHardwareId::GetSerialKey()
{
	std::string SerialKey = "61A345B5496B2";
	std::string CompName = this->GetCompUserName(false);
	std::string UserName = this->GetCompUserName(true);

	SerialKey.append(this->StringToHex(this->GetMyHWUID()));
	SerialKey.append(_T("-"));
	SerialKey.append(this->StringToHex(std::to_string(this->GetVolumeID())));
	SerialKey.append(_T("-"));
	SerialKey.append(this->StringToHex(CompName));
	SerialKey.append(_T("-"));
	SerialKey.append(this->StringToHex(UserName));

	return SerialKey;
}

std::string cHardwareId::GetHashText(const void* data, const size_t data_size)
{
	HCRYPTPROV hProv = NULL;

	if (!CryptAcquireContext(&hProv, NULL, NULL, PROV_RSA_AES, CRYPT_VERIFYCONTEXT))
	{
		return "";
	}

	BOOL hash_ok = FALSE;
	HCRYPTPROV hHash = NULL;

	hash_ok = CryptCreateHash(hProv, CALG_MD5, 0, 0, &hHash);

	if (!hash_ok)
	{
		CryptReleaseContext(hProv, 0);
		return "";
	}

	if (!CryptHashData(hHash, static_cast<const BYTE*>(data), data_size, 0))
	{
		CryptDestroyHash(hHash);
		CryptReleaseContext(hProv, 0);
		return "";
	}

	DWORD cbHashSize = 0, dwCount = sizeof(DWORD);
	if (!CryptGetHashParam(hHash, HP_HASHSIZE, (BYTE*)&cbHashSize, &dwCount, 0))
	{
		CryptDestroyHash(hHash);
		CryptReleaseContext(hProv, 0);
		return "";
	}

	std::vector<BYTE> buffer(cbHashSize);

	if (!CryptGetHashParam(hHash, HP_HASHVAL, (LPBYTE)(&buffer[0]), &cbHashSize, 0))
	{
		CryptDestroyHash(hHash);
		CryptReleaseContext(hProv, 0);
		return "";
	}

	std::ostringstream oss;

	for (std::vector<BYTE>::const_iterator iter = buffer.begin(); iter != buffer.end(); ++iter)
	{
		oss.fill('0');
		oss.width(2);
		oss << std::hex << StaCa<const int>(*iter);
	}

	CryptDestroyHash(hHash);
	CryptReleaseContext(hProv, 0);
	return oss.str();
}

std::string cHardwareId::GetHashSerialKey()
{
	std::string SerialKey = this->GetSerialKey();
	const void* pData = SerialKey.c_str();
	size_t Size = SerialKey.size();
	std::string Hash = this->GetHashText(pData, Size);

	for (auto& c : Hash)
	{
		if (c >= 'a' && c <= 'f')
		{
			c = '4';
		}
		else if (c == 'b')
		{
			c = '5';
		}
		else if (c == 'c')
		{
			c = '6';
		}
		else if (c == 'd')
		{
			c = '7';
		}
		else if (c == 'e')
		{
			c = '8';
		}
		else if (c == 'f')
		{
			c = '9';
		}

		c = toupper(c);
	}

	return Hash;
}

std::string cHardwareId::GetSerial()
{
	std::string Serial = "";
	std::string HashSerialKey = this->GetHashSerialKey();

	std::string Serial1 = HashSerialKey.substr(0, 4);
	std::string Serial2 = HashSerialKey.substr(4, 4);
	std::string Serial3 = HashSerialKey.substr(8, 4);
	std::string Serial4 = HashSerialKey.substr(12, 4);

	Serial += Serial1;
	Serial += '-';
	Serial += Serial2;
	Serial += '-';
	Serial += Serial3;
	Serial += '-';
	Serial += Serial4;

	return Serial;
}

bool cHardwareId::CheckHWIDLock()
{
	this->matchedName = ""; // Reset matched name
	std::string currentHWID = this->GetSerial();

	if (currentHWID.empty()) {
		return false;
	}

	// ------------------------------------------------------------------------
	// Verification Endpoint:
	// Para sa Vercel (Online):  "https://hwid-management-system.vercel.app/api/verify?hwid="
	// Para sa Local Testing:    "http://127.0.0.1:3000/api/verify?hwid="
	// ------------------------------------------------------------------------
	std::string baseUrl = "https://hwid-management-system.vercel.app/api/verify?hwid=";
	
	// Kung gusto mo mag-test sa localhost habang bukas ang python server.py:
	// std::string baseUrl = "http://127.0.0.1:3000/api/verify?hwid=";

	std::string verifyUrl = baseUrl + currentHWID;
	std::string response = this->GetHWIDList(verifyUrl);

	if (response.empty()) {
		return false;
	}

	// Trim whitespace / newlines / carriage returns
	response = CUtils::get()->Trim(response);

	// 1. Plain Text Check: "AUTH_OK:Username"
	if (response.rfind("AUTH_OK:", 0) == 0)
	{
		this->matchedName = response.substr(8); // Extracts the authorized username
		return true; // License is valid and active!
	}

	// 2. JSON Fallback Check: {"valid":true,"user":"Username"}
	if (response.find("\"valid\":true") != std::string::npos || response.find("\"valid\": true") != std::string::npos)
	{
		size_t userPos = response.find("\"user\":");
		if (userPos != std::string::npos)
		{
			size_t startQuote = response.find('\"', userPos + 7);
			size_t endQuote = response.find('\"', startQuote + 1);
			if (startQuote != std::string::npos && endQuote != std::string::npos)
			{
				this->matchedName = response.substr(startQuote + 1, endQuote - startQuote - 1);
			}
		}
		return true;
	}

	// Response is "AUTH_DENIED:Suspended", "AUTH_DENIED:Expired", or "AUTH_FAILED:Not Registered"
	return false;
}

std::string cHardwareId::GetMatchedName()
{
	return this->matchedName.empty() ? "Unknown User" : this->matchedName;
}