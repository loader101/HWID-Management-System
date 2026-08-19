#ifndef _HARDWARE_ID_H_
#define _HARDWARE_ID_H_

#pragma once

#include "pch.h"

enum class HWIDStatus
{
	Active = 0,
	Suspended,
	Expired,
	Unauthorized,
	ConnectionError
};

class cHardwareId : public Singleton<cHardwareId>
{
private:
	std::string matchedName = "Unknown User";
	std::string licenseStatus = "Unauthorized";
	std::string expirationDate = "N/A";
	int remainingDays = -1;
	HWIDStatus statusCode = HWIDStatus::Unauthorized;

public:
	std::string GetHWIDList(const std::string& url);
	std::string GetCompUserName(bool User);
	std::string StringToHex(const std::string input);

	DWORD GetVolumeID();

	std::string GetMyHWUID();
	std::string GetSerialKey();
	std::string GetHashText(const void* data, const size_t data_size);
	std::string GetHashSerialKey();
	std::string GetSerial();

	bool CheckHWIDLock();

	std::string GetMatchedName();
	std::string GetLicenseStatus();
	std::string GetExpiration();
	int GetRemainingDays();
	HWIDStatus GetStatusCode();

	bool IsActive();
	bool IsSuspended();
	bool IsExpired();
	bool IsAuthorized();
};

#endif

