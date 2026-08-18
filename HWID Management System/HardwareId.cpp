#include "HardwareId.hpp"

std::string cHardwareId::GetHWIDList(const std::string& url)
{
	HINTERNET hInternet = InternetOpen("HWIDChecker", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
	if (!hInternet) return "";

	HINTERNET hFile = InternetOpenUrl(hInternet, url.c_str(), NULL, 0, INTERNET_FLAG_RELOAD, 0);
	if (!hFile)
	{
		InternetCloseHandle(hInternet);
		return "";
	}

	char buffer[4096];
	DWORD bytesRead;
	std::string result;

	while (InternetReadFile(hFile, buffer, sizeof(buffer), &bytesRead) && bytesRead != 0)
	{
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

//bool cHardwareId::CheckHWIDLock()
//{
//	this->matchedName = ""; // reset
//
//	std::string hwidListRaw = this->GetHWIDList("https://drive.google.com/uc?export=download&id=10JTzwtuGqScIrnWhNJbx5WGxbmmEAeDV");
//	if (hwidListRaw.empty()) return false;
//
//	std::istringstream iss(hwidListRaw);
//	std::string line;
//	std::string currentHWID = this->GetSerial();
//
//	while (std::getline(iss, line))
//	{
//		size_t delimiter = line.find(':');
//		if (delimiter != std::string::npos)
//		{
//			std::string name = line.substr(0, delimiter);
//			std::string hwid = line.substr(delimiter + 1);
//
//			if (hwid == currentHWID)
//			{
//				this->matchedName = name;
//				return true;
//			}
//		}
//	}
//
//	return false;
//}

bool cHardwareId::CheckHWIDLock()
{
	this->matchedName = ""; // Reset matched name

	// Vercel HWID Management Endpoint (e.g. https://your-project.vercel.app/api/raw or http://localhost:3000/api/raw)
	std::string hwidListRaw = this->GetHWIDList("https://your-domain.vercel.app/api/raw");

	if (hwidListRaw.empty()) {
		return false;
	}

	std::istringstream iss(hwidListRaw);
	std::string line;
	std::string currentHWID = this->GetSerial();

	while (std::getline(iss, line)) {
		if (line.empty()) continue;

		size_t delimiter = line.find(':');
		if (delimiter != std::string::npos) {
			std::string name = line.substr(0, delimiter);
			std::string hwid = line.substr(delimiter + 1);

			name = CUtils::get()->Trim(name);
			hwid = CUtils::get()->Trim(hwid);

			if (hwid == currentHWID) {
				this->matchedName = name;
				return true;
			}
		}
	}

	return false; // No match found
}

std::string cHardwareId::GetMatchedName()
{
	return this->matchedName.empty() ? "Unknown User" : this->matchedName;
}