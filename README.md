# Project-Akhir-PAA-TRUE
Ini adalah Tugas akhir mata kuliah PAA Universitas Maritim Raja Ali Haji Kelompok terdiri dari: Riki Andika Syaputra (2401020134), Rahmat Sucipto Halawa (2401020130), Muhammad Khaerul Sukandar (2401020131), Rhaditia Rangga (2401020099), Ferdian Fahrul Hamzahri (2401020101)


# 2D Urban Spatial Map Navigation Simulation

Sebuah sistem simulasi interaktif berbasis web dua dimensi (2D) untuk memodelkan navigasi objek (kendaraan) pada peta spasial perkotaan perkiraan dinamis. Proyek ini mengintegrasikan perhitungan jarak dunia nyata menggunakan **Rumus Haversine**, interpolasi koordinat berbasis **Cubic Bézier Curve**, penentuan jalur (*routing*), serta penataan tata ruang kota prosedural secara acak menggunakan HTML5 Canvas.

## 🚀 Fitur Utama

* **Pembangkitan Kota Prosedural (*Procedural City Generation*):** Menghasilkan jaringan jalan utama, persimpangan bundaran, gang komplek perumahan, bangunan ruko, lahan parkir, dan vegetasi secara dinamis dan acak setiap kali peta diubah (*Acak Map*).
* **Perhitungan Jarak Haversine:** Mengonversi koordinat piksel simulasi ke skala geografis nyata untuk menghitung jarak rute antara titik *Start* dan *Destination* dalam satuan meter.
* **Pergerakan Halus dengan Kurva Bézier:** Jalan raya utama dimodelkan menggunakan kurva Bézier kubik guna memastikan pergerakan kendaraan saat berbelok dan berakselerasi terlihat realistis.
* **Multi-Vehicle Selection:** Mendukung simulasi tiga jenis kendaraan berbeda (Mobil 🚗, Motor 🏍️, dan Sepeda 🚲) dengan karakteristik kecepatan yang disesuaikan.
* **Kontrol Kamera Interaktif:** Fitur *drag/pan* untuk menggeser peta dan fitur *scroll-to-zoom* untuk memperbesar atau memperkecil visualisasi kamera simulasi.
* **Sinkronisasi Frame Rate:** Animasi menggunakan `requestAnimationFrame` dengan perhitungan delta-time untuk menjaga pergerakan tetap konsisten di berbagai spesifikasi layar monitor.

---

## 🛠️ Detail Teknis & Algoritma

### 1. Perhitungan Jarak Geografis (Haversine)
Sistem menggunakan rumus Haversine untuk mengukur jarak matematis di atas permukaan bumi yang melengkung berdasarkan titik asal referensi kota:
* **Latitude Asal:** `-0.9205`
* **Longitude Asal:** `104.4750`
* **Skala Geografis:** `0.00001` per unit piksel.

### 2. Interpolasi Jalur (Cubic Bézier Curve)
Untuk menghaluskan pergerakan objek pada jalan raya yang melengkung, digunakan fungsi posisi titik kurva Bézier kubik:

$$P(t) = (1-t)^3 P_0 + 3(1-t)^2 t P_1 + 3(1-t) t^2 P_2 + t^3 P_3$$

Dan penentuan sudut rotasi kendaraan ditentukan lewat turunan pertama (*tangent angle*) dari fungsi kurva tersebut.

### 3. Validasi Spasial Aman (*Collision Avoidance*)
Sistem memiliki fungsi *checking* spasial yang ketat (`isPosisiSangatAman` & `isJalurGangAman`) untuk memastikan ruko, rumah gang, dan pohon tidak saling tumpang tindih (*overlap*) dengan badan jalan utama, trotoar, maupun area bundaran tengah kota.

---

## 🎮 Cara Menggunakan Simulasi

1.  **Buka File:** Jalankan file `PAA.html` pada peramban web (*browser*) pilihan Anda (Chrome, Edge, Firefox, atau Safari).
2.  **Pilih Kendaraan:** Klik salah satu jenis kendaraan pada panel kontrol (Mobil, Motor, atau Sepeda).
3.  **Tentukan Titik Awal (Start):** Klik kiri pada area jalan raya aspal mana pun di peta. Pin biru akan muncul sebagai penanda.
4.  **Tentukan Titik Tujuan (Destination):** Klik kiri kembali pada area jalan raya lainnya. Pin merah akan muncul, dan sistem akan langsung mengalkulasi jalur beserta jarak rutenya.
5.  **Mulai Simulasi:** Klik tombol **MULAI** untuk menjalankan kendaraan. Kamera akan otomatis mengunci dan mengikuti pergerakan objek (*Camera Tracking*).
6.  **Interaksi Kamera:** * *Klik & Geser (Drag):* Untuk menggeser peta secara manual saat simulasi berhenti.
    * *Scroll Mouse:* Untuk melakukan *Zoom In* dan *Zoom Out*.
7.  **Manipulasi Peta:** Klik **ACAK MAP** untuk mendesain ulang tata ruang kota baru secara acak, atau klik **RESET** untuk menghapus rute navigasi aktif.

---

## 📂 Struktur Berkas

* `PAA.html` — Berkas tunggal (*monolithic file*) yang berisi struktur antarmuka (HTML5), gaya visual panel UI (CSS), dan seluruh logika algoritma inti serta rendering grafis (JavaScript).

---

## 💻 Spesifikasi Teknologi

* **HTML5 Canvas:** Untuk melakukan rendering grafis 2D performa tinggi secara langsung.
* **Vanilla JavaScript (ES6+):** Digunakan penuh untuk kalkulasi logika matematika kurva, struktur data graf rute jalan, dan state management simulasi tanpa *dependency* atau *library* pihak ketiga.
* **CSS3 Backdrop Filter:** Memberikan efek blur modern (*glassmorphism*) pada panel kontrol UI di atas kanvas.
