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

bool cHardwareId::CheckHWIDLock()
{
	// 1. Reset state
	this->matchedName = "Unknown User";
	this->licenseStatus = "Unauthorized";
	this->expirationDate = "N/A";
	this->remainingDays = -1;
	this->statusCode = HWIDStatus::Unauthorized;

	std::string currentHWID = this->GetSerial();
	if (currentHWID.empty())
	{
		this->licenseStatus = "Invalid HWID";
		this->statusCode = HWIDStatus::Unauthorized;
		return false;
	}

	// 2. Direct Vercel System API Verification
	std::string verifyUrl = "https://hwid-management-system.vercel.app/api/verify?hwid=" + currentHWID;
	std::string response = this->GetHWIDList(verifyUrl);

	// Fallback to secondary raw endpoint if direct verify returned empty (e.g. network hiccup)
	if (response.empty())
	{
		std::string rawUrl = "https://hwid-management-system.vercel.app/api/raw";
		std::string rawList = this->GetHWIDList(rawUrl);

		if (!rawList.empty())
		{
			std::istringstream iss(rawList);
			std::string line;

			while (std::getline(iss, line))
			{
				if (line.empty()) continue;
				size_t delimiter = line.find(':');
				if (delimiter != std::string::npos)
				{
					std::string name = line.substr(0, delimiter);
					std::string hwid = line.substr(delimiter + 1);

					name = CUtils::get()->Trim(name);
					hwid = CUtils::get()->Trim(hwid);

					if (hwid == currentHWID)
					{
						this->matchedName = name;
						this->licenseStatus = "Active";
						this->expirationDate = "Lifetime (Raw Sync)";
						this->remainingDays = -1;
						this->statusCode = HWIDStatus::Active;
						return true;
					}
				}
			}
		}

		// If still empty / server unreachable
		this->licenseStatus = "Connection Error / Server Offline";
		this->statusCode = HWIDStatus::ConnectionError;
		return false;
	}

	response = CUtils::get()->Trim(response);

	// 3. Parse tokens: "PREFIX:Username:ExpirationDisplay:Status"
	std::vector<std::string> tokens;
	std::istringstream tokenStream(response);
	std::string token;
	while (std::getline(tokenStream, token, ':'))
	{
		tokens.push_back(CUtils::get()->Trim(token));
	}

	std::string prefix = tokens.empty() ? "" : tokens[0];

	// Handle AUTH_OK (Active & Authorized)
	if (prefix == "AUTH_OK")
	{
		this->matchedName = (tokens.size() > 1 && !tokens[1].empty()) ? tokens[1] : "Active User";
		this->expirationDate = (tokens.size() > 2 && !tokens[2].empty()) ? tokens[2] : "Lifetime";
		this->licenseStatus = "Active";
		this->statusCode = HWIDStatus::Active;
		return true;
	}
	// Handle AUTH_SUSPENDED (Account Blocked / Suspended by Admin)
	else if (prefix == "AUTH_SUSPENDED" || response.find("AUTH_DENIED:Suspended") != std::string::npos)
	{
		this->matchedName = (tokens.size() > 1 && !tokens[1].empty()) ? tokens[1] : "Suspended User";
		this->expirationDate = (tokens.size() > 2 && !tokens[2].empty()) ? tokens[2] : "Suspended";
		this->licenseStatus = "Suspended";
		this->statusCode = HWIDStatus::Suspended;
		return false;
	}
	// Handle AUTH_EXPIRED (License Duration Expired)
	else if (prefix == "AUTH_EXPIRED" || response.find("AUTH_DENIED:Expired") != std::string::npos)
	{
		this->matchedName = (tokens.size() > 1 && !tokens[1].empty()) ? tokens[1] : "Expired User";
		this->expirationDate = (tokens.size() > 2 && !tokens[2].empty()) ? tokens[2] : "Expired";
		this->licenseStatus = "Expired";
		this->statusCode = HWIDStatus::Expired;
		return false;
	}
	// Handle AUTH_FAILED / Unauthorized
	else
	{
		this->matchedName = "Unregistered User";
		this->expirationDate = "N/A";
		this->licenseStatus = "Not Registered / Unauthorized";
		this->statusCode = HWIDStatus::Unauthorized;
		return false;
	}
}

std::string cHardwareId::GetMatchedName()
{
	return this->matchedName.empty() ? "Unknown User" : this->matchedName;
}

std::string cHardwareId::GetLicenseStatus()
{
	return this->licenseStatus.empty() ? "Unauthorized" : this->licenseStatus;
}

std::string cHardwareId::GetExpiration()
{
	return this->expirationDate.empty() ? "N/A" : this->expirationDate;
}

int cHardwareId::GetRemainingDays()
{
	return this->remainingDays;
}

HWIDStatus cHardwareId::GetStatusCode()
{
	return this->statusCode;
}

bool cHardwareId::IsActive()
{
	return this->statusCode == HWIDStatus::Active;
}

bool cHardwareId::IsSuspended()
{
	return this->statusCode == HWIDStatus::Suspended;
}

bool cHardwareId::IsExpired()
{
	return this->statusCode == HWIDStatus::Expired;
}

bool cHardwareId::IsAuthorized()
{
	return this->statusCode == HWIDStatus::Active;
}