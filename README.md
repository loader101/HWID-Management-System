# 🛡️ HWID Management System (Vercel Direct API & C++ Compatible)

Ang system na ito ay may **Direct Website API Verification** para sa [HardwareId.cpp](file:///c:/Users/jaymi/Desktop/Vercel/HWID%20Management%20System/HardwareId.cpp). Hindi mo na kailangan pang mag-download ng buong raw text file!

---

## 🚀 Paano Gumagana sa C++ (Direct API Verification)

Sa [HardwareId.cpp](file:///c:/Users/jaymi/Desktop/Vercel/HWID%20Management%20System/HardwareId.cpp#L256-L289), palitan ang URL ng iyong Vercel link:

```cpp
bool cHardwareId::CheckHWIDLock()
{
    this->matchedName = ""; // Reset matched name
    std::string currentHWID = this->GetSerial();

    if (currentHWID.empty()) {
        return false;
    }

    // Direct Website API Verification:
    std::string verifyUrl = "https://hwid-management-system.vercel.app/api/verify?hwid=" + currentHWID;
    std::string response = this->GetHWIDList(verifyUrl);

    if (response.empty()) {
        return false;
    }

    response = CUtils::get()->Trim(response);

    // Kapag binalik ng server ay "AUTH_OK:Username"
    if (response.rfind("AUTH_OK:", 0) == 0)
    {
        this->matchedName = response.substr(8); // Awtomatikong makukuha ang Username!
        return true; // License is valid and active!
    }

    // Response is "AUTH_DENIED:Suspended", "AUTH_DENIED:Expired", or "AUTH_FAILED:Not Registered"
    return false;
}
```

---

## 📡 API Endpoints

| Endpoint | Method | Format | Description |
| :--- | :--- | :--- | :--- |
| `/api/verify?hwid=XXXX` | `GET` | Plain Text / JSON | **Pangunahing verification endpoint** para sa C++ client. Nagbabalik ng `AUTH_OK:Username`, `AUTH_DENIED:Suspended`, `AUTH_DENIED:Expired`, o `AUTH_FAILED:Not Registered`. |
| `/api/raw` / `/raw.txt` | `GET` | Plain Text | Nagbabalik ng listahan ng mga active users (`NAME:HWID`). |
| `/api/hwids` | `GET/POST/PUT/DELETE` | JSON | Dashboard REST API para sa pag-activate, pag-edit, pag-delete, at pag-sync. |
| `/api/auth` | `POST` | JSON | Admin Password validation para sa dashboard. |

---

## 🌐 Paano I-Deploy sa Vercel

1. I-push ang repo na ito sa **GitHub**.
2. Pumunta sa [Vercel](https://vercel.com/new) at i-import ang repository.
3. I-click ang **Deploy**.
4. Sa Vercel Project Dashboard, pumunta sa **Storage** tab -> i-connect ang libreng **Upstash Redis** para laging permanent ang lahat ng data sa cloud.
