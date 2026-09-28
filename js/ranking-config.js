// みんなのランキングの保存先（Firebase / Cloud Firestore）。
// Firebase コンソールの「プロジェクトの設定 → マイアプリ（ウェブ）」に出る値を入れる。
// null のままならランキングは「この端末」だけになる。
// ※ ウェブ用の apiKey は公開前提の値（秘密鍵ではない）。書き込みの制限は firestore.rules で行う。
window.RANKING_FIREBASE = null;
// 例:
// window.RANKING_FIREBASE = { apiKey: "AIza...", projectId: "bichon-48weeks" };
