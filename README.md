# 🛡️ HWID Management System (Vercel & C++ Compatible)

Ang system na ito ay ginawa para sa automated activation, management, at verification ng **Hardware IDs (HWID)**. Tamang-tama ito para sa C++ client sa [HardwareId.cpp](file:///c:/Users/jaymi/Desktop/Vercel/HWID%20Management%20System/HardwareId.cpp).

---

## 🚀 Quick Start (Local Testing)

Dahil may kasamang built-in zero-dependency Python server, maaari mo itong patakbuhin agad sa iyong computer:

```bash
python server.py
```

Pagkatapos patakbuhin:
- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Raw Text Endpoint**: [http://localhost:3000/api/raw](http://localhost:3000/api/raw)
- **Default Admin Key**: `admin123`

---

## 🌐 Paano I-Deploy sa Vercel

### Paraan 1: Gamit ang GitHub (Pinakamadali)
1. I-upload ang folder na ito sa isang **GitHub Repository** (Private o Public).
2. Pumunta sa [Vercel Dashboard](https://vercel.com/new).
3. Piliin ang **Import Git Repository** at piliin ang iyong repository.
4. I-click ang **Deploy** (Zero configuration needed, awtomatikong ide-detect ng Vercel ang `/api` serverless routes at static dashboard!).
5. Kapag tapos na, makakakuha ka ng domain tulad ng: `https://your-project.vercel.app`.

---

## 💾 Cloud Persistence (Upstash Redis / Vercel KV)

Sa Vercel Serverless, para hindi mawala ang data ng mga activated HWIDs:
1. Sa iyong Vercel Project Dashboard, pumunta sa tab na **Storage**.
2. Piliin ang **Upstash** o **KV** (Libre / Free Tier).
3. I-link ito sa iyong Project. Awtomatikong idaragdag ng Vercel ang environment variables:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
4. Awtomatikong gagamitin ng system ang Upstash Redis para sa cloud storage!

---

## 💻 Pagsasama sa HardwareId.cpp

Buksan ang `HardwareId.cpp` sa linya 260 at palitan ang URL ng iyong Vercel endpoint:

```cpp
bool cHardwareId::CheckHWIDLock()
{
    this->matchedName = ""; // Reset matched name

    // Ilagay ang iyong Vercel URL dito:
    std::string hwidListRaw = this->GetHWIDList("https://your-project.vercel.app/api/raw");

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
```

---

## 📡 API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/raw` | `GET` | Nagbabalik ng `text/plain` na listahan ng mga active users (`NAME:HWID`). Ito ang binabasa ng C++ client. |
| `/api/verify?hwid=XXXX` | `GET` | Mabilisang pag-check kung active, suspended, o expired ang isang HWID (JSON). |
| `/api/hwids` | `GET` | Kinukuha ang lahat ng HWIDs kasama ang statistics (Kailangan ng Admin Secret). |
| `/api/hwids` | `POST` | Nag-aactivate ng bagong HWID (Single o Bulk). |
| `/api/hwids` | `PUT` | Nag-uupdate ng status (Active/Suspended), Expiration, o Notes. |
| `/api/hwids` | `DELETE` | Nagtatanggal ng HWID license. |
| `/api/auth` | `POST` | Nagbe-verify ng Admin Password para sa dashboard. |

---

## 🎨 Mga Tampok ng Dashboard
- ⚡ **Auto-Format HWID**: Awtomatikong naglalagay ng hyphens (`XXXX-XXXX-XXXX-XXXX`) habang nagta-type.
- 📦 **Bulk Import**: Pwedeng mag-paste ng maramihang `NAME:HWID` lines.
- ⏳ **Expiry Presets**: Lifetime, 1 Day, 7 Days, 30 Days, o Custom Expiry.
- 📋 **One-Click Copy**: Madaling kopyahin ang `NAME:HWID`, raw URL, o C++ snippet.
- 🔐 **Admin PIN Protection**: Protektado ang dashboard laban sa unauthorized access.
