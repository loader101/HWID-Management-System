#include <thread>
#include "DiscordApi.hpp"

std::string cDiscordApi::GetLocationInfo(const std::string& ip)
{
	HINTERNET hInternet = InternetOpen("GeoLookup", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
	if (!hInternet)
		return "Unknown";

	std::string apiUrl = "http://ip-api.com/json/" + ip;
	HINTERNET hFile = InternetOpenUrl(hInternet, apiUrl.c_str(), NULL, 0, INTERNET_FLAG_RELOAD, 0);
	if (!hFile)
	{
		InternetCloseHandle(hInternet);
		return "Unknown";
	}

	char buffer[2048] = {};
	DWORD bytesRead;
	InternetReadFile(hFile, buffer, sizeof(buffer) - 1, &bytesRead);

	InternetCloseHandle(hFile);
	InternetCloseHandle(hInternet);

	std::string json(buffer);

	auto getValue = [](const std::string& json, const std::string& key) -> std::string
		{
			std::string search = "\"" + key + "\":\"";
			size_t start = json.find(search);
			if (start == std::string::npos)
				return "N/A";

			start += search.length();
			size_t end = json.find("\"", start);
			if (end == std::string::npos)
				return "N/A";

			return json.substr(start, end - start);
		};

	std::string country = getValue(json, "country");
	std::string region = getValue(json, "regionName");
	std::string city = getValue(json, "city");
	std::string isp = getValue(json, "isp");

	return country + ", " + region + ", " + city + " - " + isp;
}

std::string cDiscordApi::GetIPAddress()
{
	HINTERNET hInternet = InternetOpen("IPGetter", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
	if (!hInternet)
		return "Unknown";

	HINTERNET hFile = InternetOpenUrl(hInternet, "https://api.ipify.org", NULL, 0, INTERNET_FLAG_RELOAD, 0);
	if (!hFile)
	{
		InternetCloseHandle(hInternet);
		return "Unknown";
	}

	char buffer[64] = { 0 };
	DWORD bytesRead;
	InternetReadFile(hFile, buffer, sizeof(buffer) - 1, &bytesRead);

	InternetCloseHandle(hFile);
	InternetCloseHandle(hInternet);

	return std::string(buffer);
}

static std::string EscapeJsonString(const std::string& input)
{
	std::string output;
	for (char c : input)
	{
		if (c == '"') output += "\\\"";
		else if (c == '\\') output += "\\\\";
		else if (c == '\b') output += "\\b";
		else if (c == '\f') output += "\\f";
		else if (c == '\n') output += "\\n";
		else if (c == '\r') output += "\\r";
		else if (c == '\t') output += "\\t";
		else output += c;
	}
	return output;
}

void cDiscordApi::SendToDiscordEmbed(const std::string& webhookPath, const std::string& title, const std::string& user, const std::string& hwid, const std::string& computerName, const std::string& userName, const std::string& ip, const std::string& location, const std::string& datetime, const std::string& status, const std::string& statusColor, const std::string& expiration, const std::string& cfUser, const std::string& cfIgn)
{
	HINTERNET hInternet = InternetOpen("DiscordWebhook", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
	if (!hInternet)
		return;

	HINTERNET hConnect = InternetConnect(hInternet, "discord.com", INTERNET_DEFAULT_HTTPS_PORT, NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
	if (!hConnect)
	{
		InternetCloseHandle(hInternet);
		return;
	}

	const char* parrAcceptTypes[] = { "*/*", NULL };
	HINTERNET hRequest = HttpOpenRequest(hConnect, "POST", webhookPath.c_str(), NULL, NULL, parrAcceptTypes, INTERNET_FLAG_SECURE, 0);
	if (!hRequest)
	{
		InternetCloseHandle(hConnect);
		InternetCloseHandle(hInternet);
		return;
	}

	std::string displayCfUser = cfUser.empty() ? "N/A" : cfUser;
	std::string displayCfIgn = cfIgn.empty() ? "N/A" : cfIgn;
	std::string displayExpiration = expiration.empty() ? "Lifetime" : expiration;

	std::ostringstream oss;
	oss << "{"
		<< "\"embeds\": [{"
		<< "\"title\": \"" << EscapeJsonString(title) << "\","
		<< "\"color\": " << statusColor << ","

		<< "\"fields\": ["

		<< "{\"name\": \"User\", \"value\": \"" << EscapeJsonString(user) << "\", \"inline\": true},"
		<< "{\"name\": \"Status\", \"value\": \"" << EscapeJsonString(status) << "\", \"inline\": true},"
		<< "{\"name\": \"Expiration\", \"value\": \"" << EscapeJsonString(displayExpiration) << "\", \"inline\": true},"

		<< "{\"name\": \"HWID\", \"value\": \"" << EscapeJsonString(hwid) << "\", \"inline\": false},"

		<< "{\"name\": \"CF-USER\", \"value\": \"" << EscapeJsonString(displayCfUser) << "\", \"inline\": true},"
		<< "{\"name\": \"CF-IGN\", \"value\": \"" << EscapeJsonString(displayCfIgn) << "\", \"inline\": true},"

		<< "{\"name\": \"Computer Name\", \"value\": \"" << EscapeJsonString(computerName) << "\", \"inline\": true},"
		<< "{\"name\": \"User Name\", \"value\": \"" << EscapeJsonString(userName) << "\", \"inline\": true},"

		<< "{\"name\": \"IP Address\", \"value\": \"" << EscapeJsonString(ip) << "\", \"inline\": true},"
		<< "{\"name\": \"Location\", \"value\": \"" << EscapeJsonString(location) << "\", \"inline\": true},"

		<< "{\"name\": \"Date and Time\", \"value\": \"" << EscapeJsonString(datetime) << "\", \"inline\": false}"

		<< "],"
		<< "\"footer\": {\"text\": \"HWID Management System • Security & Activity Logger\"}"
		<< "}]"
		<< "}";

	std::string jsonPayload = oss.str();
	std::string headers = "Content-Type: application/json\r\n";

	HttpSendRequest(hRequest, headers.c_str(), headers.length(), (LPVOID)jsonPayload.c_str(), jsonPayload.length());

	InternetCloseHandle(hRequest);
	InternetCloseHandle(hConnect);
	InternetCloseHandle(hInternet);
}

void cDiscordApi::SendGameTimeToDiscord(const std::string& user, const std::string& serial, const std::string& expireDate, const std::string& computerName, const std::string& userName, const std::string& datetime, const std::string& ip, const std::string& location, const std::string& cfUser, const std::string& cfIgn)
{
	static bool reset_once = false;

	if (cEngine::get()->IsGameReadyForHook())
	{
		static CTimer g_GameTime;
		static CTimer g_SendTime;

		uint64_t elapsedMs = g_GameTime.GetMs();
		uint64_t totalSeconds = (elapsedMs / 1000);
		int hours = StaCa<int>(totalSeconds / 3600);
		int minutes = StaCa<int>((totalSeconds % 3600) / 60);
		int seconds = StaCa<int>(totalSeconds % 60);

		std::string gameTimeStr = std::to_string(hours) + "h " + std::to_string(minutes) + "m " + std::to_string(seconds) + "s";

		if (g_SendTime.WaitForMilliseconds(180000)) // 3 minutes = 180,000 milliseconds
		{
			if (reset_once == false)
			{
				std::thread([this, user, serial, expireDate, computerName, userName, datetime, gameTimeStr, cfUser, cfIgn]() {
					std::string _ip = this->GetIPAddress();
					std::string _location = this->GetLocationInfo(_ip);

					std::string discordWebHooks = "/api/webhooks/1443246398815469578/s1xH9fV9SfaUNqr5w7GueEj0uYbLOE6erL71DDSdf9Zt4lYgRtG_PphIiD2zuhTZs_BK";
					this->SendToDiscordEmbed
					(
						discordWebHooks.c_str(),
						"🎮 [IN-GAME LOG] Player Activity & Playtime",
						user,
						serial.empty() ? cHardwareId::get()->GetSerial() : serial,
						computerName,
						userName,
						_ip,
						_location,
						datetime,
						"Play Time: " + gameTimeStr,
						"3066993",
						expireDate,
						cfUser,
						cfIgn
					);
				}).detach();
				reset_once = true;
			}
			g_SendTime.ResetMs();
		}
		else reset_once = false;
	}
	else reset_once = false;
}

void cDiscordApi::SendInGameTimeToDiscord()
{
	std::string ip = "";
	std::string location = "";
	std::string serial = cHardwareId::get()->GetSerial();
	std::string datetime = CUtils::get()->GetDateTime();
	std::string username = cHardwareId::get()->GetCompUserName(true);
	std::string computername = cHardwareId::get()->GetCompUserName(false);
	std::string expiration = cHardwareId::get()->GetExpiration();

	if (this->IsSentToDiscord)
	{
		std::string cfUser = "";
		std::string cfIgn = "";
		uint64_t cshell = P::get()->GetCShellInstance();
		if (cshell != 0)
		{
			auto cf_username_ = (const char*)(cshell + m_GetUserName);
			auto cf_ign_ = (const char*)(cshell + m_GetIGN);
			if (cf_username_ != nullptr && !CUtils::get()->IsBadPointer((void*)cf_username_) && strlen(cf_username_) >= 2)
				cfUser = cf_username_;
			if (cf_ign_ != nullptr && !CUtils::get()->IsBadPointer((void*)cf_ign_) && strlen(cf_ign_) >= 2)
				cfIgn = cf_ign_;
		}
		this->SendGameTimeToDiscord(cHardwareId::get()->GetMatchedName(), serial, expiration, computername, username, datetime, "NULL", "NULL", cfUser, cfIgn);
	}
}

void cDiscordApi::SendInfoToDiscord(const std::string& cfUser, const std::string& cfIgn)
{
	if (this->IsSentToDiscord)
		return;

	std::string ip = this->GetIPAddress();
	std::string location = this->GetLocationInfo(ip);
	std::string serial = cHardwareId::get()->GetSerial();
	std::string datetime = CUtils::get()->GetDateTime();
	std::string username = cHardwareId::get()->GetCompUserName(true);
	std::string computername = cHardwareId::get()->GetCompUserName(false);

	bool isAuthorized = cHardwareId::get()->CheckHWIDLock();
	std::string name = cHardwareId::get()->GetMatchedName();
	std::string expiration = cHardwareId::get()->GetExpiration();
	HWIDStatus statusCode = cHardwareId::get()->GetStatusCode();

	std::string title;
	std::string status;
	std::string color;

	if (statusCode == HWIDStatus::Active || isAuthorized)
	{
		title = "🟢 [AUTH SUCCESS] User Activity Detected";
		status = "✅ Active / Authorized";
		color = "65280"; // Bright Green (0x00FF00)
	}
	else if (statusCode == HWIDStatus::Suspended)
	{
		title = "⛔ [AUTH SUSPENDED] Suspended User Detected";
		status = "🚫 Suspended / Blacklisted";
		color = "16744192"; // Orange-Red (0xFFA500)
	}
	else if (statusCode == HWIDStatus::Expired)
	{
		title = "⏰ [AUTH EXPIRED] Expired User Access Attempt";
		status = "⚠️ License Expired";
		color = "16753920"; // Amber (0xFFA500)
	}
	else if (statusCode == HWIDStatus::ConnectionError)
	{
		title = "🔌 [AUTH ERROR] Verification Server Offline";
		status = "❓ Connection Error / API Offline";
		color = "10066329"; // Gray
	}
	else
	{
		title = "🔴 [AUTH DENIED] Unauthorized Access Attempt";
		status = "❌ Not Registered / Unauthorized";
		color = "16711680"; // Red (0xFF0000)
	}

	std::string displayCfUser = cfUser;
	std::string displayCfIgn = cfIgn;

	if (displayCfUser.empty() || displayCfIgn.empty())
	{
		uint64_t cshell = P::get()->GetCShellInstance();
		if (cshell != 0)
		{
			auto cf_username_ = (const char*)(cshell + m_GetUserName);
			auto cf_ign_ = (const char*)(cshell + m_GetIGN);
			if (cf_username_ != nullptr && !CUtils::get()->IsBadPointer((void*)cf_username_) && strlen(cf_username_) >= 2 && displayCfUser.empty())
				displayCfUser = cf_username_;
			if (cf_ign_ != nullptr && !CUtils::get()->IsBadPointer((void*)cf_ign_) && strlen(cf_ign_) >= 2 && displayCfIgn.empty())
				displayCfIgn = cf_ign_;
		}
	}
	std::string discordWebHooks = "/api/webhooks/1443246398815469578/s1xH9fV9SfaUNqr5w7GueEj0uYbLOE6erL71DDSdf9Zt4lYgRtG_PphIiD2zuhTZs_BK";
	this->SendToDiscordEmbed(
		discordWebHooks.c_str(),
		title,
		name,
		serial,
		computername,
		username,
		ip,
		location,
		datetime,
		status,
		color,
		expiration,
		displayCfUser,
		displayCfIgn
	);

	this->IsSentToDiscord = true;
}