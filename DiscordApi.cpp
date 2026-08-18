#include <thread>
#include "DiscordApi.hpp"
#include "HardwareId.hpp"

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

void cDiscordApi::SendToDiscordEmbed(const std::string& webhookPath, const std::string& title, const std::string& user, const std::string& hwid, const std::string& computerName, const std::string& userName, const std::string& ip, const std::string& location, const std::string& datetime, const std::string& status, const std::string& statusColor, const std::string& cfUser, const std::string& cfIgn)
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
	std::string rawPair = user + ":" + hwid;

	std::ostringstream oss;
	oss << "{"
		<< "\"content\": \"📌 **HWID Log:** `" << rawPair << "`\","
		<< "\"embeds\": [{"
		<< "\"title\": \"" << title << "\","
		<< "\"color\": " << statusColor << ","

		<< "\"fields\": ["

		<< "{\"name\": \"User\", \"value\": \"" << user << "\", \"inline\": true},"
		<< "{\"name\": \"HWID\", \"value\": \"`" << hwid << "`\", \"inline\": true},"
		<< "{\"name\": \"USER:HWID Pair\", \"value\": \"`" << rawPair << "`\", \"inline\": false},"
		<< "{\"name\": \"CF-USER\", \"value\": \"" << displayCfUser << "\", \"inline\": true},"
		<< "{\"name\": \"CF-IGN\", \"value\": \"" << displayCfIgn << "\", \"inline\": true},"
		<< "{\"name\": \"Computer Name\", \"value\": \"" << computerName << "\", \"inline\": true},"
		<< "{\"name\": \"User Name\", \"value\": \"" << userName << "\", \"inline\": true},"
		<< "{\"name\": \"IP Address\", \"value\": \"" << ip << "\", \"inline\": true},"
		<< "{\"name\": \"Location\", \"value\": \"" << location << "\", \"inline\": false},"
		<< "{\"name\": \"Date and Time\", \"value\": \"" << datetime << "\", \"inline\": true},"
		<< "{\"name\": \"Status\", \"value\": \"" << status << "\", \"inline\": true}"

		<< "]"
		<< "}]"
		<< "}";

	std::string jsonPayload = oss.str();
	std::string headers = "Content-Type: application/json\r\n";

	HttpSendRequest(hRequest, headers.c_str(), headers.length(), (LPVOID)jsonPayload.c_str(), jsonPayload.length());

	InternetCloseHandle(hRequest);
	InternetCloseHandle(hConnect);
	InternetCloseHandle(hInternet);
}

void cDiscordApi::SendGameTimeToDiscord(const std::string& user, const std::string& serial, const std::string& computerName, const std::string& userName, const std::string& datetime, const std::string& ip, const std::string& location, const std::string& cfUser, const std::string& cfIgn)
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
				std::thread([this, user, computerName, userName, datetime, gameTimeStr, cfUser, cfIgn]() {
					std::string _ip = this->GetIPAddress();
					std::string _location = this->GetLocationInfo(_ip);

					std::string discordWebHooks = "/api/webhooks/1443246398815469578/s1xH9fV9SfaUNqr5w7GueEj0uYbLOE6erL71DDSdf9Zt4lYgRtG_PphIiD2zuhTZs_BK";
					this->SendToDiscordEmbed
					(
						discordWebHooks.c_str(),
						"Game Info",
						user, cHardwareId::get()->GetSerial(),
						computerName,
						userName, _ip, _location, datetime,
						"Play Time: " + gameTimeStr,
						"255",
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
	std::string serial = "";
	std::string datetime = CUtils::get()->GetDateTime();
	std::string username = cHardwareId::get()->GetCompUserName(true);
	std::string computername = cHardwareId::get()->GetCompUserName(false);

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
		this->SendGameTimeToDiscord(cHardwareId::get()->GetMatchedName(), "NULL", computername, username, datetime, "NULL", "NULL", cfUser, cfIgn);
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

	std::string status;
	std::string color;
	std::string title;

	if (isAuthorized)
	{
		status = "✅ Activated";
		color = "65280"; // Green
		title = "✅ User Login: " + name;
	}
	else
	{
		// Expired / Unauthorized Attempt Log (USER:HWID format)
		status = "❌ EXPIRED / UNAUTHORIZED (" + name + ":" + serial + ")";
		color = "16711680"; // Red
		title = "⚠️ EXPIRED / UNAUTHORIZED LOGS: " + name + ":" + serial;
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
		displayCfUser,
		displayCfIgn
	);

	this->IsSentToDiscord = true;
}

void cDiscordApi::SendExpiredLog(const std::string& user, const std::string& hwid)
{
	std::string ip = this->GetIPAddress();
	std::string location = this->GetLocationInfo(ip);
	std::string datetime = CUtils::get()->GetDateTime();
	std::string username = cHardwareId::get()->GetCompUserName(true);
	std::string computername = cHardwareId::get()->GetCompUserName(false);

	std::string discordWebHooks = "/api/webhooks/1443246398815469578/s1xH9fV9SfaUNqr5w7GueEj0uYbLOE6erL71DDSdf9Zt4lYgRtG_PphIiD2zuhTZs_BK";
	this->SendToDiscordEmbed(
		discordWebHooks.c_str(),
		"⚠️ EXPIRED LOGS: " + user + ":" + hwid,
		user,
		hwid,
		computername,
		username,
		ip,
		location,
		datetime,
		"❌ EXPIRED (BLOCKED)",
		"16744192" // Orange/Red
	);
}