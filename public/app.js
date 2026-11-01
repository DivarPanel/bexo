import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit, addDoc, setDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app), functions=getFunctions(app);
const $=id=>document.getElementById(id);
const STORES=["Imperial","Eurohome","Sumqayıt","Abşeron","Vasmoy","Ağ Şəhər"];
let currentUser=null, profile=null, cache={sales:[],products:[],customers:[],expenses:[],receipts:[],inventory:[],closures:[]};
const money=n=>(Number(n)||0).toLocaleString("az-AZ",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₼";
const dayKey=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Baku",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isAdmin=()=>profile?.role==="admin";
const myStore=()=>profile?.storeId||"";
const canStore=()=>isAdmin()?STORES:([myStore()]);
function setNotice(msg){$("globalNotice").textContent=msg;$("globalNotice").classList.remove("hidden")}
function clearNotice(){$("globalNotice").classList.add("hidden")}
function setPage(id){document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id==="page-"+id));document.querySelectorAll(".nav-btn").forEach(x=>x.classList.toggle("active",x.dataset.page===id));$("pageHeading").textContent=document.querySelector(`[data-page="${id}"]`)?.textContent.trim()||id}
document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.page)));
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();$("loginError").textContent="";try{await signInWithEmailAndPassword(auth,$("email").value,$("password").value)}catch(err){$("loginError").textContent=err.message}});
$("logoutBtn").addEventListener("click",()=>signOut(auth));
onAuthStateChanged(auth,async user=>{
 currentUser=user;
 if(!user){$("loginView").classList.remove("hidden");$("appView").classList.add("hidden");return}
 try{
  const snap=await getDoc(doc(db,"users",user.uid));
  if(!snap.exists()||snap.data().active===false)throw new Error("İstifadəçi profili tapılmadı və ya deaktivdir. Firestore users sənədini yoxlayın.");
  profile={uid:user.uid,...snap.data()};
  if(!["admin","manager","salesperson","warehouseKeeper"].includes(profile.role))throw new Error("İstifadəçi rolu düzgün təyin edilməyib.");
  $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");
  $("userName").textContent=profile.displayName||user.email;$("userRole").textContent=profile.role;$("userStore").textContent=isAdmin()?"Bütün mağazalar":profile.storeId;
  document.querySelectorAll("[data-admin]").forEach(el=>el.classList.toggle("hidden",!isAdmin()));
  $("today").textContent=dayKey();populateSelects();await refreshAll();clearNotice();
 }catch(err){await signOut(auth);$("loginView").classList.remove("hidden");$("loginError").textContent=err.message}
});
function populateSelects(){
 const opts=canStore().map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("");
 ["saleStore","receiptStore","expenseStore","customerStore"].forEach(id=>$(id).innerHTML=opts);
}
async function getList(name, constraints=[]){const q=query(collection(db,name),...constraints);const snap=await getDocs(q);return snap.docs.map(d=>({id:d.id,...d.data()}))}
async function refreshAll(){
 try{
  const store= myStore();
  const storeFilter=(field)=>isAdmin()?[]:[where(field,"==",store)];
  const tasks=[
   getList("sales",[...storeFilter("storeId"),orderBy("createdAt","desc"),limit(150)]),
   getList("products"),
   getList("customers",[...storeFilter("storeId"),orderBy("name")]),
   getList("expenses",[...storeFilter("storeId"),orderBy("createdAt","desc"),limit(150)]),
   getList("goodsReceipts",[...storeFilter("storeId"),orderBy("createdAt","desc"),limit(100)]),
   getList("storeInventory"),
   getList("dailyClosures",[...storeFilter("storeId"),orderBy("businessDate","desc"),limit(30)])
  ];
  [cache.sales,cache.products,cache.customers,cache.expenses,cache.receipts,cache.inventory,cache.closures]=await Promise.all(tasks);
  render();$("connection").textContent="Firebase qoşulub";$("connection").className="tag";
 }catch(e){$("connection").textContent="Məlumat xətası";setNotice("Məlumat yüklənmədi: "+e.message+" Firestore indekslərini və Security Rules qaydalarını yoxlayın.")}
}
function fmtDate(v){if(!v)return "—";const d=v.toDate?v.toDate():new Date(v);return d.toLocaleString("az-AZ",{timeZone:"Asia/Baku"})}
function storeName(id){return id||"—"}
function render(){
 const today=dayKey(), sales=cache.sales.filter(x=>x.businessDate===today), expenses=cache.expenses.filter(x=>x.businessDate===today);
 const total=sales.reduce((a,x)=>a+(x.total||0),0), exp=expenses.reduce((a,x)=>a+(x.amount||0),0);
 $("mSales").textContent=money(total);$("mCount").textContent=sales.length;$("mExpenses").textContent=money(exp);$("mPayments").textContent=money(sales.filter(x=>x.paymentMethod!=="Nisyə").reduce((a,x)=>a+(x.total||0),0));
 $("storeSummary").innerHTML=(isAdmin()?STORES:[myStore()]).map(s=>`<div class="store-tile"><b>${esc(s)}</b><strong>${money(cache.sales.filter(x=>x.storeId===s&&x.businessDate===today).reduce((a,x)=>a+(x.total||0),0))}</strong><small>Bugünkü satış</small></div>`).join("");
 $("recentActivity").innerHTML=[...cache.sales.slice(0,5).map(x=>`<p>Satış · ${esc(storeName(x.storeId))} · ${esc(x.productName)} · ${money(x.total)}</p>`),...cache.expenses.slice(0,3).map(x=>`<p>Xərc · ${esc(x.storeId)} · ${money(x.amount)}</p>`)].join("")||"Əməliyyat yoxdur";
 $("storesGrid").innerHTML=STORES.map(s=>`<div class="store-tile"><b>${esc(s)}</b><p>Satış: ${money(cache.sales.filter(x=>x.storeId===s).reduce((a,x)=>a+(x.total||0),0))}</p><small>Stok məlumatı digər mağazalara yalnız baxış üçündür.</small></div>`).join("");
 $("salesTable").innerHTML=cache.sales.map(x=>`<tr><td>${fmtDate(x.createdAt)}</td><td>${esc(x.storeId)}</td><td>${esc(x.productName)}</td><td>${x.quantity}</td><td>${money(x.total)}</td><td>${esc(x.paymentMethod)}</td><td>${esc(x.status||"Qeyd edildi")}</td></tr>`).join("")||'<tr><td colspan="7">Satış yoxdur</td></tr>';
 $("productsTable").innerHTML=cache.products.map(p=>{const inv=cache.inventory.filter(x=>x.productId===p.id);return `<tr><td>${esc(p.code||"—")}</td><td>${esc(p.name)}</td><td>${esc(p.barcode||"—")}</td><td>${money(p.salePrice)}</td><td>${inv.map(i=>`${esc(i.storeId)}: ${i.quantity}`).join("<br>")||"Qalıq qeyd edilməyib"}</td></tr>`}).join("")||'<tr><td colspan="5">Məhsul yoxdur</td></tr>';
 $("receiptsList").innerHTML=cache.receipts.map(x=>`<p>${fmtDate(x.createdAt)} · ${esc(x.warehouseId)} → ${esc(x.storeId)} · ${esc(x.productName)} × ${x.quantity} · ${esc(x.status)}</p>`).join("")||"Mal qəbulu yoxdur";
 $("expensesList").innerHTML=cache.expenses.map(x=>`<p>${fmtDate(x.createdAt)} · ${esc(x.storeId)} · ${esc(x.category)} · ${money(x.amount)} · ${esc(x.note||"")}</p>`).join("")||"Xərc yoxdur";
 $("customersTable").innerHTML=cache.customers.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.phone||"—")}</td><td>${esc(x.storeId)}</td><td>${esc(x.address||"—")}</td></tr>`).join("")||'<tr><td colspan="4">Müştəri yoxdur</td></tr>';
 const pay=m=>money(sales.filter(x=>x.paymentMethod===m).reduce((a,x)=>a+(x.total||0),0));
 $("cashNaqd").textContent=pay("Nağd");$("cashPos").textContent=pay("POS");$("cashBank").textContent=pay("Bank köçürməsi");
 $("cashDetails").innerHTML=`<p>Nağd: <b>${pay("Nağd")}</b></p><p>POS: <b>${pay("POS")}</b></p><p>Bank köçürməsi: <b>${pay("Bank köçürməsi")}</b></p>`;
 $("reportSummary").innerHTML=`<h2>Hesabat xülasəsi · ${today}</h2><p>Satış sayı: <b>${sales.length}</b></p><p>Dövriyyə: <b>${money(total)}</b></p><p>Xərclər: <b>${money(exp)}</b></p><p>Satış minus xərc (sadə fərq): <b>${money(total-exp)}</b></p>`;
 const closed=cache.closures.find(x=>x.businessDate===today);$("closureState").textContent=closed?"Gün bağlanıb":"Gün açıqdır";$("closeDayBtn").disabled=!!closed;$("closureHistory").innerHTML=cache.closures.map(x=>`<p>${esc(x.businessDate)} · ${esc(x.storeId)} · ${esc(x.status)}</p>`).join("");
 $("saleProduct").innerHTML=cache.products.map(p=>`<option value="${p.id}" data-price="${p.salePrice}" data-name="${esc(p.name)}">${esc(p.name)} (${money(p.salePrice)})</option>`).join("");
 $("receiptProduct").innerHTML=cache.products.map(p=>`<option value="${p.id}" data-name="${esc(p.name)}">${esc(p.name)}</option>`).join("");
 $("saleCustomer").innerHTML='<option value="">Müştərisiz satış</option>'+cache.customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}
$("saleProduct").addEventListener("change",()=>{$("salePrice").value=$("saleProduct").selectedOptions[0]?.dataset.price||0;previewTotal()});
["saleQty","salePrice","deliveryFee","serviceFee","saleDiscount"].forEach(id=>$(id).addEventListener("input",previewTotal));
function previewTotal(){const v=(+$("saleQty").value||0)*(+$("salePrice").value||0)+(+$("deliveryFee").value||0)+(+$("serviceFee").value||0)-(+$("saleDiscount").value||0);$("saleTotalPreview").textContent="Cəmi: "+money(Math.max(0,v))}
$("saleForm").addEventListener("submit",async e=>{
 e.preventDefault();try{
  const productId=$("saleProduct").value,p=cache.products.find(x=>x.id===productId);if(!p)throw new Error("Əvvəlcə məhsul yaradın.");
  const storeId=isAdmin()?$ ("saleStore").value:myStore();const qty=+$("saleQty").value,price=+$("salePrice").value;
  const payload={storeId,productId,productName:p.name,quantity:qty,unitPrice:price,deliveryFee:+$("deliveryFee").value||0,serviceFee:+$("serviceFee").value||0,discount:+$("saleDiscount").value||0,total:qty*price+(+$("deliveryFee").value||0)+(+$("serviceFee").value||0)-(+$("saleDiscount").value||0),paymentMethod:$("salePayment").value,customerId:$("saleCustomer").value||null,note:$("saleNote").value};
  if(payload.total<0)throw new Error("Endirim satış cəmindən çox ola bilməz.");
  await addDoc(collection(db,"sales"),{...payload,status:"recorded",businessDate:dayKey(),createdAt:serverTimestamp(),createdBy:currentUser.uid});
  e.target.reset();await refreshAll();alert("Satış qeydə alındı.");
 }catch(err){alert("Satış alınmadı: "+err.message)}
});
$("productForm").addEventListener("submit",async e=>{e.preventDefault();try{if(!isAdmin())throw new Error("Məhsul yaratmaq yalnız Admin üçündür.");await addDoc(collection(db,"products"),{name:$("productName").value.trim(),code:$("productCode").value.trim(),barcode:$("productBarcode").value.trim(),salePrice:+$("productPrice").value,minStock:+$("productMin").value||0,active:true,createdAt:serverTimestamp(),createdBy:currentUser.uid});e.target.reset();await refreshAll()}catch(err){alert(err.message)}});
$("receiptForm").addEventListener("submit",async e=>{e.preventDefault();try{const storeId=isAdmin()?$("receiptStore").value:myStore(),p=cache.products.find(x=>x.id===$("receiptProduct").value);await addDoc(collection(db,"goodsReceipts"),{warehouseId:$("receiptWarehouse").value,storeId,productId:p.id,productName:p.name,quantity:+$("receiptQty").value,note:$("receiptNote").value,status:"pending_approval",businessDate:dayKey(),createdAt:serverTimestamp(),createdBy:currentUser.uid});e.target.reset();await refreshAll();alert("Mal qəbulu müraciəti yaradıldı. Təhvil təsdiqi Admin prosesindən sonra stok hərəkətinə çevrilməlidir.")}catch(err){alert(err.message)}});
$("expenseForm").addEventListener("submit",async e=>{e.preventDefault();try{const storeId=isAdmin()?$("expenseStore").value:myStore();await addDoc(collection(db,"expenses"),{storeId,category:$("expenseCategory").value,amount:+$("expenseAmount").value,paymentMethod:$("expensePayment").value,note:$("expenseNote").value,businessDate:dayKey(),createdAt:serverTimestamp(),createdBy:currentUser.uid});e.target.reset();await refreshAll()}catch(err){alert(err.message)}});
$("customerForm").addEventListener("submit",async e=>{e.preventDefault();try{const storeId=isAdmin()?$("customerStore").value:myStore();await addDoc(collection(db,"customers"),{storeId,name:$("customerName").value.trim(),phone:$("customerPhone").value.trim(),address:$("customerAddress").value.trim(),createdAt:serverTimestamp(),createdBy:currentUser.uid});e.target.reset();await refreshAll()}catch(err){alert(err.message)}});
$("closeDayBtn").addEventListener("click",async()=>{if(!confirm("Bu mağazanın bugünkü əməliyyatlarını bağlamaq istəyirsiniz? Bağlanmış gün dəyişdirilə bilməz."))return;try{const close= httpsCallable(functions,"closeBusinessDay");await close({businessDate:dayKey(),storeId:isAdmin()?$("saleStore").value:myStore()});await refreshAll();alert("Gün bağlandı.")}catch(err){alert("Gün bağlanmadı: "+err.message)}});
$("addStoreBtn").addEventListener("click",()=>alert("Mağaza əlavə etmək üçün stores kolleksiyası və Security Rules administrator tərəfindən yenilənməlidir. Bu ilkin versiyada 6 təsdiqlənmiş mağaza sabitdir."));
