# 🏝️ Dynamic Island Hybrid for GNOME Shell

[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-46%20--%2051-blue.svg?logo=gnome)](https://www.gnome.org/)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-green.svg)](LICENSE)
[![Platform: Wayland & X11](https://img.shields.io/badge/Platform-Wayland%20%7C%20X11-purple.svg)](https://wayland.freedesktop.org/)

An advanced, feature-rich iOS-style **Dynamic Island** extension for **GNOME Shell**.

This hybrid edition combines the clean, lightweight, spring-animated foundation of [basskibo](https://github.com/basskibo/linux_dynamic_island) with the entertainment polish of [NotchNux](https://github.com/Adityasah2004/NotchNux) and the productivity power of [NexNotch](https://github.com/NexVar/NexNotch).

---

## ✨ Features (Tính năng nổi bật)

### 🎨 Apple Glassmorphism Styling
* Elegant translucent frosted glass backdrop (`rgba(18, 18, 24, 0.88)`).
* Subtle border glow (`1px solid rgba(255, 255, 255, 0.16)`) and soft 3D drop-shadow.
* Damped spring physics with natural bounce on expand/collapse.

### 🎵 Enhanced Media Player (Trình phát nhạc cao cấp)
* **Timeline Scrubber:** Displays a live progress bar with elapsed and total duration (`01:25 / 03:40`).
* **Cover Art & EQ Visualizer:** High-definition album art with spring transition and 4-bar equalizer animation.
* **Full MPRIS Support:** Seamless integration with Spotify, YouTube in browsers, VLC, and local players.

### 🔔 Notification Peek (Xem nhanh thông báo)
* When a new notification arrives (Telegram, Zalo, Discord, Gmail, System), the island automatically morphs into a pill banner displaying the app icon, title, and body for **3.8 seconds**.
* **Interactive:** Click the notification pill to jump straight to the app!

### ⚡ Zero-Overhead Hardware Monitor (Giám sát phần cứng)
* Live tracking of **CPU Usage %** and **RAM (GB / %)**.
* Reads directly from `/proc/stat` and `/proc/meminfo` — **0% idle CPU footprint**, no heavy background daemons or extra dependencies required.
* Click the chip to open **GNOME System Monitor**.

### 🍅 Pomodoro Focus Timer (Đồng hồ tập trung)
* Integrated focus session timer right in your island.
* **1-Click Cycle:** Start 25m Focus ➔ 5m Break ➔ Reset.
* Toast reminders notify you when each session starts and finishes.

### ⌨️ Global Keybinding (Phím tắt toàn cục)
* Press **`Super (Windows) + I`** anywhere on your desktop to instantly toggle/expand the island without touching your mouse.

### 🎛️ System OSD & Indicators
* **Volume & Brightness:** Replaces GNOME's bulky center popup with a sleek pill indicator.
* **Battery & Power:** Live toast alert when AC charger is plugged or unplugged.
* **Bluetooth:** Toast notifications when Bluetooth devices connect/disconnect.
* **Screen Recording:** Active timer chip during screen recording sessions.
* **Progress Bar:** Realtime progress indicator for downloads and large file copies.

---

## 🚀 Installation (Hướng dẫn cài đặt)

### Cách 1: Cài đặt nhanh qua Git (Quick Install)

Clone repository và chạy script cài đặt tự động:

```bash
git clone https://github.com/hoangvandat8679-dot/gnome-dynamic-island.git
cd gnome-dynamic-island
chmod +x install.sh
./install.sh
```

### Cách 2: Đóng gói thành file zip extension (Manual Package)

```bash
chmod +x pack.sh
./pack.sh
gnome-extensions install --force dynamic-island@bjagetic.shell-extension.zip
gnome-extensions enable dynamic-island@bjagetic
```

> **Ghi chú trên Wayland**: Sau khi cài đặt lần đầu, hãy Đăng xuất (Log out) và Đăng nhập lại để GNOME Shell nhận diện extension đầy đủ.

---

## ⚙️ Configuration (Tùy chỉnh & Cài đặt)

Mở cài đặt extension bằng lệnh:

```bash
gnome-extensions prefs dynamic-island@bjagetic
```

Hoặc mở ứng dụng **Extensions (Tiện ích mở rộng)** ➔ tìm **Dynamic Island Hybrid** ➔ bấm biểu tượng bánh răng ⚙️.

Trong bảng cài đặt, bạn có thể:
* Chọn vị trí hiển thị: Trên - Giữa (`Top center`), Góc trên trái (`Top left`), Góc trên phải (`Top right`),...
* Điều chỉnh khoảng cách mép màn hình (*margin*).
* Bật / tắt độc lập từng tính năng: Notification Peek, Hardware Monitor, Pomodoro Timer, Media, OSD, Bluetooth.

---

## 🤝 Credits & Acknowledgements

* **[Bojan Jagetic (basskibo)](https://github.com/basskibo/linux_dynamic_island)**: Original clean architecture, spring physics, and modular source system.
* **[Aditya Sah (NotchNux)](https://github.com/Adityasah2004/NotchNux)**: Inspiration for media timeline scrubber, album art styling, and notification peek.
* **[NexVar (NexNotch)](https://github.com/NexVar/NexNotch)**: Inspiration for system monitoring metrics and Pomodoro focus workflow.

---

## 📜 License

Distributed under the **GNU General Public License v3.0**. See [`LICENSE`](LICENSE) for details.
