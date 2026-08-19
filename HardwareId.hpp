#ifndef _HARDWARE_ID_H_
#define _HARDWARE_ID_H_

#pragma once

#include "pch.h"

class cHardwareId : public Singleton<cHardwareId>
{
private:
	std::string matchedName = "";
	std::string hwidStatus  = "Unauthorized";  // FIX: was missing from header

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
	std::string GetHWIDStatus();  // FIX: was missing from header
	bool IsExpired();              // FIX: was missing from header
};

#endif
