# 🛡️ HWID Management System (Vercel Direct API, Expiration & Discord Logs)

Ang system na ito ay may **Direct API Verification** para sa [HardwareId.cpp](file:///c:/Users/jaymi/Desktop/Vercel/HWID%20Management%20System/HardwareId.cpp) at [DiscordApi.cpp](file:///c:/Users/jaymi/Desktop/Vercel/HWID%20Management%20System/DiscordApi.cpp). 

---

## 🚀 C++ Integration (`HardwareId.cpp`)

Sa [HardwareId.cpp](file:///c:/Users/jaymi/Desktop/Vercel/HWID%20Management%20System/HardwareId.cpp), awtomatikong kumokonekta sa iyong live API sa Vercel:

```cpp
bool cHardwareId::CheckHWIDLock()
{
    // 1. Reset state
    this->matchedName = "Unknown User";
    this->licenseStatus = "Unauthorized";
    this->expirationDate = "N/A";
    this->remainingDays = -1;
    this->statusCode = HWIDStatus::Unauthorized;

    std::string currentHWID = this->GetSerial();
    if (currentHWID.empty()) return false;

    // 2. Direct Website API Verification (Vercel)
    std::string verifyUrl = "https://hwid-management-system.vercel.app/api/verify?hwid=" + currentHWID;
    std::string response = this->GetHWIDList(verifyUrl);

    // Fallback sa /api/raw kapag may server connection timeout
    if (response.empty()) {
        this->licenseStatus = "Connection Error / Server Offline";
        this->statusCode = HWIDStatus::ConnectionError;
        return false;
    }

    response = CUtils::get()->Trim(response);

    std::vector<std::string> tokens;
    std::istringstream tokenStream(response);
    std::string token;
    while (std::getline(tokenStream, token, ':')) {
        tokens.push_back(CUtils::get()->Trim(token));
    }

    std::string prefix = tokens.empty() ? "" : tokens[0];

    // AUTH_OK (Active)
    if (prefix == "AUTH_OK") {
        this->matchedName = (tokens.size() > 1 && !tokens[1].empty()) ? tokens[1] : "Active User";
        this->expirationDate = (tokens.size() > 2 && !tokens[2].empty()) ? tokens[2] : "Lifetime";
        this->licenseStatus = "Active";
        this->statusCode = HWIDStatus::Active;
        return true;
    } 
    // AUTH_SUSPENDED (Suspended / Blocked)
    else if (prefix == "AUTH_SUSPENDED") {
        this->matchedName = (tokens.size() > 1 && !tokens[1].empty()) ? tokens[1] : "Suspended User";
        this->expirationDate = (tokens.size() > 2 && !tokens[2].empty()) ? tokens[2] : "Suspended";
        this->licenseStatus = "Suspended";
        this->statusCode = HWIDStatus::Suspended;
        return false;
    } 
    // AUTH_EXPIRED (Expired)
    else if (prefix == "AUTH_EXPIRED") {
        this->matchedName = (tokens.size() > 1 && !tokens[1].empty()) ? tokens[1] : "Expired User";
        this->expirationDate = (tokens.size() > 2 && !tokens[2].empty()) ? tokens[2] : "Expired";
        this->licenseStatus = "Expired";
        this->statusCode = HWIDStatus::Expired;
        return false;
    } 
    // AUTH_FAILED (Not Registered)
    else {
        this->matchedName = "Unregistered User";
        this->licenseStatus = "Not Registered / Unauthorized";
        this->statusCode = HWIDStatus::Unauthorized;
        return false;
    }
}
```

---

## 📡 Discord Embed Logging (`DiscordApi.cpp`)

Awtomatikong nagpapadala ng color-coded embed logs sa Discord:
- **Active User**: 🟢 Green (`65280`) - Naglalaman ng User Name, Status, Expiration, HWID, IP, Location, Computer/Windows Name, at CF-USER / CF-IGN.
- **Suspended User**: ⛔ Orange/Red (`16744192`) - Na-lolockout at na-lolog ang attempted access kasama ang user identity.
- **Expired User**: ⏰ Amber (`16753920`) - Na-lolog ang attempted access kasama ang date kung kailan nag-expire ang license.
- **Unauthorized User**: 🔴 Red (`16711680`) - Na-lolog ang unregistered HWID attempt.

---

## 📡 API Endpoints

| Endpoint | Method | Format | Description |
| :--- | :--- | :--- | :--- |
| `/api/verify?hwid=XXXX` | `GET` | Plain Text / JSON | **Pangunahing verification endpoint**. Nagbabalik ng `AUTH_OK:Name:Expiry:active`, `AUTH_SUSPENDED:Name:Expiry:suspended`, `AUTH_EXPIRED:Name:Expiry:expired`, o `AUTH_FAILED:Not Registered:N/A:unregistered`. |
| `/api/raw` / `/raw.txt` | `GET` | Plain Text | Nagbabalik ng listahan ng mga active users (`NAME:HWID`). |
| `/api/hwids` | `GET/POST/PUT/DELETE` | JSON | Dashboard REST API para sa pag-activate, pag-edit, pag-delete, at pag-sync. |
| `/api/auth` | `POST` | JSON | Admin Password validation para sa dashboard. |

