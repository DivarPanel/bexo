MÜSTƏQİL BİZNES İDARƏETMƏ SİSTEMİ — GITHUB + FIREBASE QURAŞDIRMA

Bu paket real Firebase layihəsinə qoşulmaq üçün hazırlanmış ilkin tətbiq skeletidir. Firebase config doldurulmadan işləməyəcək. Paketdə frontend, Firestore Security Rules, indekslər, Hosting konfiqurasiyası və gün bağlanması Cloud Function-u var.

1) YENİ FIREBASE LAYİHƏSİ
- https://console.firebase.google.com/ açın.
- Add project ilə tamamilə yeni layihə yaradın.
- Authentication > Sign-in method > Email/Password aktiv edin.
- Firestore Database yaradın (Production mode).
- Project settings > Your apps > Web app əlavə edin.
- Web app config dəyərlərini public/firebase-config.js faylına yazın.
- Buraya service-account private key, admin parolu və ya gizli açar yazmayın.

2) İLK ADMIN HESABI
- Firebase Console > Authentication > Users > Add user ilə admin e-mail və şifrə yaradın.
- Firestore-da users kolleksiyası yaradın.
- Sənəd ID-si Authentication-dakı admin UID olmalıdır.
- Nümunə sənəd:
  {
    "displayName": "System Admin",
    "role": "admin",
    "active": true
  }
- Mağaza işçisi üçün users/{UID} sənədi:
  {
    "displayName": "Imperial Satıcı",
    "role": "salesperson",
    "storeId": "Imperial",
    "active": true
  }
- Rol dəyərləri: admin, manager, salesperson, warehouseKeeper.
- Mağaza ID-ləri dəqiq belə olmalıdır:
  Imperial, Eurohome, Sumqayıt, Abşeron, Vasmoy, Ağ Şəhər.
- Anbar ID-ləri: Abşeron Anbar, Dərnəgül Anbar.

3) GITHUB-A YÜKLƏMƏ
- ZIP-i açın.
- GitHub-da yeni private repository yaradın (məlumatların qorunması üçün private tövsiyə olunur).
- public, functions qovluqları və firebase.json, firestore.rules, firestore.indexes.json fayllarını repository-yə yükləyin.
- public/firebase-config.js daxilində Firebase config-i əlavə edin.
- GitHub Pages bu layihə üçün əsas hosting seçimi deyil; Firebase Hosting istifadə edin. GitHub kod deposu olacaq.

4) FIREBASE HOSTING-Ə DEPLOY
Kompüterdə Node.js LTS və Firebase CLI quraşdırın:
  npm install -g firebase-tools
Sonra layihə qovluğunda:
  firebase login
  firebase use --add
  firebase init
Əgər firebase init yenidən sual verirsə, Hosting, Firestore və Functions seçin; mövcud firebase.json fayllarını qoruyun.
  cd functions
  npm install
  cd ..
  firebase deploy --only firestore:rules,firestore:indexes,hosting,functions

Cloud Functions və Scheduler üçün Firebase layihəsində Blaze billing planı tələb oluna bilər. Deploy zamanı Firebase-in göstərdiyi billing və region şərtlərini yoxlayın. Function regionu europe-west1-dir.

5) FIRESTORE İLKİN MƏLUMAT STRUKTURU
- users/{uid}: displayName, role, storeId (mağaza işçisi üçün), active
- stores/{storeId}: name, active
- products/{productId}: name, code, barcode, salePrice, minStock, active
- storeInventory/{storeId_productId}: storeId, productId, quantity, updatedAt
- sales/{saleId}: storeId, productId, productName, quantity, unitPrice, deliveryFee, serviceFee, discount, total, paymentMethod, businessDate, createdBy, createdAt, status
- customers/{customerId}: storeId, name, phone, address, createdBy, createdAt
- expenses/{expenseId}: storeId, category, amount, paymentMethod, note, businessDate, createdBy, createdAt
- goodsReceipts/{receiptId}: warehouseId, storeId, productId, productName, quantity, status, createdBy, createdAt
- dailyClosures/{storeId_YYYY-MM-DD}: server tərəfindən yaradılan bağlanma yekunu
- activityLogs/{logId}: server tərəfindən yaradılan audit qeydi

6) VACİB FUNKSİONAL QEYDLƏR
- Admin bütün mağazaları görür.
- Mağaza istifadəçisi yalnız öz satış, müştəri, xərc və qəbul qeydlərini görür.
- Mağazalar storeInventory kolleksiyasını yalnız oxuya bilər; müştəri tətbiqindən stok yazmaq qadağandır.
- Digər mağazaların stokuna baxış açıqdır.
- Satışlar və xərclər yaradıldıqdan sonra dəyişdirilə/silinmir.
- Bağlanmış günün ilkin qeydləri dəyişdirilə bilməz.
- Gün bağlanması Cloud Function ilə yaradılır.
- Bu ilkin versiyada mal qəbulu təsdiqi və storeInventory-yə stok yazılması üçün ayrıca Admin callable function əlavə edilməlidir; qəbul forması hazırda pending_approval sənədi yaradır.
- Bu ilkin versiyada satış yaradılması məhsul stokunu avtomatik azaltmır. Real istifadədən əvvəl sale creation üçün etibarlı Cloud Function yazılmalı, stok çıxışı və satış eyni Firestore transaction-da aparılmalıdır.
- POS terminal/bank API, WhatsApp Business API, e-mail SMTP, avtomatik backup və QR/PDF sənəd şablonlarının provayder bağlantıları ayrıca qurulmalıdır.
- Offline yazılar və konflikt həlli hələ aktivləşdirilməyib.
- Mağaza hesabının rol seçimi UI-dan edilmir; yalnız Admin SDK/Console ilə verilir.
- Firestore rules mütləq Firebase Emulator-da test edilməli və real işə başlamazdan əvvəl müstəqil təhlükəsizlik yoxlamasından keçməlidir.

7) GITHUB REPOSITORY
GitHub repository yalnız source code saxlayır. Firebase Hosting saytı yayımlayır. Deploy-dan sonra URL Firebase CLI tərəfindən göstəriləcək:
  https://YOUR_PROJECT_ID.web.app

Bu paket istehsal mühitinə tam hazır ERP kimi təqdim edilmir; əsas giriş, mağaza ayrımı, ilkin əməliyyat ekranları, Firestore qaydaları və gün bağlanması skeletidir. Real satış/stok mühasibatlığından əvvəl yuxarıdakı tamamlanmalı funksiyalar implementasiya və test edilməlidir.
