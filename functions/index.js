const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
initializeApp();
const db=getFirestore();
const STORES=["Imperial","Eurohome","Sumqayıt","Abşeron","Vasmoy","Ağ Şəhər"];
async function getProfile(uid){
 const s=await db.doc(`users/${uid}`).get();
 if(!s.exists || s.data().active!==true) throw new HttpsError("permission-denied","Aktiv istifadəçi profili tələb olunur.");
 return s.data();
}
function bakuDate(){
 return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Baku",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
exports.closeBusinessDay=onCall({region:"europe-west1"},async request=>{
 if(!request.auth) throw new HttpsError("unauthenticated","Giriş tələb olunur.");
 const profile=await getProfile(request.auth.uid);
 const storeId=request.data.storeId;
 const businessDate=request.data.businessDate;
 if(!STORES.includes(storeId) || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) throw new HttpsError("invalid-argument","Mağaza və tarix düzgün deyil.");
 if(profile.role!=="admin" && profile.storeId!==storeId) throw new HttpsError("permission-denied","Yalnız öz mağazanızı bağlaya bilərsiniz.");
 if(businessDate!==bakuDate()) throw new HttpsError("failed-precondition","Yalnız cari Bakı tarixini bağlamaq olar.");
 const closureId=`${storeId}_${businessDate}`;
 return await db.runTransaction(async tx=>{
  const ref=db.doc(`dailyClosures/${closureId}`);
  const existing=await tx.get(ref);
  if(existing.exists) throw new HttpsError("already-exists","Bu mağazanın günü artıq bağlanıb.");
  const salesQ=db.collection("sales").where("storeId","==",storeId).where("businessDate","==",businessDate);
  const expQ=db.collection("expenses").where("storeId","==",storeId).where("businessDate","==",businessDate);
  const [salesSnap,expenseSnap]=await Promise.all([tx.get(salesQ),tx.get(expQ)]);
  const sales=salesSnap.docs.map(d=>d.data());
  const expenses=expenseSnap.docs.map(d=>d.data());
  const totalSales=sales.reduce((a,x)=>a+(Number(x.total)||0),0);
  const totalExpenses=expenses.reduce((a,x)=>a+(Number(x.amount)||0),0);
  const payments={Nağd:0,POS:0,"Bank köçürməsi":0,Nisyə:0,Qarışıq:0};
  sales.forEach(s=>payments[s.paymentMethod]=(payments[s.paymentMethod]||0)+(Number(s.total)||0));
  tx.create(ref,{storeId,businessDate,status:"closed",closedAt:FieldValue.serverTimestamp(),closedBy:request.auth.uid,salesCount:sales.length,totalSales,totalExpenses,payments,expenseCount:expenses.length,immutable:true});
  const logRef=db.collection("activityLogs").doc();
  tx.create(logRef,{type:"daily_closure",storeId,businessDate,actorUid:request.auth.uid,createdAt:FieldValue.serverTimestamp(),details:{salesCount:sales.length,totalSales,totalExpenses}});
  return {ok:true,closureId,totalSales,totalExpenses,salesCount:sales.length};
 });
});

// Daily reminder: sends no external message by itself; records overdue store-day alerts.
exports.markUnclosedDays=onSchedule({schedule:"10 22 * * *",timeZone:"Asia/Baku",region:"europe-west1"},async()=>{
 const date=bakuDate();
 const batch=db.batch();
 for(const storeId of STORES){
  const ref=db.doc(`notifications/unclosed_${storeId}_${date}`);
  const existing=await ref.get();
  if(!existing.exists) batch.set(ref,{storeId,type:"unclosed_day_reminder",title:"Gün sonu bağlanmayıb",businessDate:date,createdAt:FieldValue.serverTimestamp(),read:false});
 }
 await batch.commit();
});
