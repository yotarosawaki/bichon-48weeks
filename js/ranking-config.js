// みんなのランキングの保存先（Firebase / Cloud Firestore）。
// null にするとランキングは「この端末」だけになる。
// ※ ウェブ用の apiKey は公開前提の値（秘密鍵ではない）。書き込みの制限は firestore.rules で行う。
window.RANKING_FIREBASE = {
  apiKey: 'AIzaSyAzBs16TjdHJFmQXjLMYoPs2FrPiWJXHCI',
  projectId: 'bichon-48weeks'
};
