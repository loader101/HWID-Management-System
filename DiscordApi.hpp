#ifndef _DISCORD_API_H_
#define _DISCORD_API_H_

#pragma once

#include "pch.h"

class cDiscordApi : public Singleton<cDiscordApi>
{
public:
	cDiscordApi()
	{
		this->IsSentToDiscord = false;
	}
	std::string GetLocationInfo(const std::string& ip);
	std::string GetIPAddress();
	void SendScreenshotToDiscord(const std::string& webhook, const std::string& filePath);
	void SendAutoScreenshot();
	void SendToDiscordEmbed(
		const std::string& webhookPath,
		const std::string& title,
		const std::string& user,
		const std::string& hwid,
		const std::string& computerName,
		const std::string& userName,
		const std::string& ip,
		const std::string& location,
		const std::string& datetime,
		const std::string& status,
		const std::string& statusColor,
		const std::string& expiration = "Lifetime",
		const std::string& cfUser = "",
		const std::string& cfIgn = ""
	);
	void SendGameTimeToDiscord(
		const std::string& user,
		const std::string& serial,
		const std::string& expireDate,
		const std::string& computerName,
		const std::string& userName,
		const std::string& datetime,
		const std::string& ip,
		const std::string& location,
		const std::string& cfUser = "",
		const std::string& cfIgn = ""
	);
	void SendInGameTimeToDiscord();
	void SendInfoToDiscord(const std::string& cfUser = "", const std::string& cfIgn = "");
public:
	bool IsSentToDiscord;
};

#endif

