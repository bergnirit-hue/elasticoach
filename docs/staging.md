# סביבת Staging והדמו

סביבת האינטגרציה שבה רואים את כל מה שמתמזג ל-`staging` לפני `main`.

> **סטטוס (2026-11-02):** לא הצלחנו לאמת פריסה ב-Vercel — אין לסשן גישה ל-Vercel,
> ובגיטהאב אין deployments / checks של Vercel על הריפו. ראו "מה נירית צריכה לעשות ב-Vercel" למטה.

## כתובת ה-Staging

- **כתובת ה-URL הקבועה של הענף:** יש לקחת מלוח הבקרה של Vercel —
  *Project → Deployments → סינון לפי Branch = `staging` → Visit*
  (בדרך כלל בצורה `https://elasticoach-git-staging-<scope>.vercel.app`).
- הכתובות `elasticoach.vercel.app` ו-`elasticoach-git-staging.vercel.app` נבדקו ומחזירות
  `DEPLOYMENT_NOT_FOUND`, כלומר עדיין אין שם פריסה.
- Supabase: פרויקט `elasticoach` (`gpgeogcweltxheokhboj`, אזור eu-central-1).

## מה נירית צריכה לעשות ב-Vercel (חד־פעמי)

1. **לוודא שהפרויקט מחובר לריפו** `bergnirit-hue/elasticoach`
   (*Project → Settings → Git*). אם אין פרויקט — *Add New → Project* ולייבא את הריפו (Framework: Next.js).
2. **Production Branch = `main`**; כל ענף אחר (כולל `staging`) נבנה כ-Preview.
3. **משתני סביבה** (*Settings → Environment Variables*), לסמן **Preview** (ו-Production):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://gpgeogcweltxheokhboj.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = ה-publishable key של הפרויקט
     (*Supabase → Project Settings → API Keys → Publishable key*)
   - לא להכניס `service_role` / סודות אחרים לשום משתנה `NEXT_PUBLIC_*`.
4. **Redeploy** של ענף `staging` (*Deployments → ⋯ → Redeploy*) אחרי הוספת המשתנים.
5. **Supabase → Authentication → URL Configuration:**
   - *Site URL*: כתובת ה-staging.
   - *Redirect URLs*: להוסיף `https://<כתובת-staging>/**` וגם `https://*-<scope>.vercel.app/**`
     (כדי שגם Preview של PR-ים יעבדו) ו-`http://localhost:3000/**`.
6. (מומלץ) *Deployment Protection*: אם Vercel Authentication פעיל על Preview, צריך להיות מחוברת
   לחשבון Vercel כדי לפתוח את הכתובת, או לכבות אותו ל-Preview.

## משתמשי הדמו

| משתמש | אימייל | תפקיד |
|---|---|---|
| נירית (דמו) | `berg.nirit+ec-nirit@gmail.com` | מאמנת **ומתאמנת** של "חברה" |
| חברה (דמו) | `berg.nirit+ec-friend@gmail.com` | מאמנת **ומתאמנת** של נירית |

- הסיסמאות נוצרו אקראית ונשמרות **רק** בקובץ מקומי שלא נכנס ל-git: `.env.staging.local`
  (בשורש הריפו על המחשב של נירית). מועברות גם בדוח הסשן.
- האימיילים הם כתובות `+alias` של Gmail של נירית, כך שהודעות (קישור כניסה) מגיעות אליה.
- **חשוב:** מסך ההתחברות באפליקציה כרגע הוא **קישור קסם (magic link) בלבד**. לכן כניסה היא
  בהזנת האימייל, ופתיחת הקישור שמגיע ל-Gmail של נירית. כניסה עם סיסמה עובדת ברמת Supabase
  (נבדק מול ה-API) אך עדיין אין לה מסך באפליקציה.
  - מגבלת שליחת מיילים של SMTP המובנה של Supabase נמוכה (כמה הודעות בשעה) — לא ללחוץ "שלח" שוב ושוב.

## הרצה חוזרת של הדמו

הקובץ `supabase/seed.sql` אידמפוטנטי (אפשר להריץ שוב ושוב; מעדכן ולא מכפיל).
לא כולל שינויי סכימה ולא סיסמאות.

1. לפתוח את הקובץ ולהחליף את שני ה-`CHANGE_ME` בשורות `set_config` בסיסמאות
   (אפשר מתוך `.env.staging.local`, או ליצור חדשות: `openssl rand -base64 18`). **לא לעשות commit לערכים.**
2. להריץ ב-*Supabase → SQL Editor* של פרויקט ה-staging, או:
   ```bash
   psql "$STAGING_DB_URL" -f supabase/seed.sql
   ```
3. המיגרציות (`supabase/migrations`) חייבות להיות מוחלות קודם — הסיד לא יוצר טבלאות.

מה נזרע: שני משתמשים מאושרים, `coach_client` הדדי (`active`) בשני הכיוונים, `user_settings`
לשניהם (יעד, משקל התחלה/יעד, תאריך התחלה, יעד מים), 7 ימי `days` אחרונים לכל אחד
(מים/צעדים/יומן אכילה/אתגר), 5 אימונים (הערות שמתחילות ב-"דמו:" — רק אותם הסיד מחליף),
ו-4 מדידות (שתי מדידות לכל אחד).

## מסלול קליקים לבדיקה

1. פתחו את כתובת ה-staging → **/login** → הזינו את האימייל של נירית (דמו) → פתחו את הקישור
   שהגיע ל-Gmail.
2. **היום שלי (`/me`)** — מונה מים (+/-), צעדים, אתגר יומי, יומן אכילה (בוקר/צהריים/ערב/ביניים),
   ורשימת האימונים של היום עם סימון "בוצע". אפשר להוסיף אימון חדש.
3. **לוח שנה (`/calendar`)** — תצוגת חודש: נקודות על ימים עם יומן/מים/אימונים; לחיצה על יום.
   האימונים מהדמו (לפני יומיים, היום, בעוד יומיים) אמורים להופיע.
4. **הגדרות (`/settings`)** — כותרת יעד, משקל התחלה/יעד, תאריך התחלה, יעד מים/צעדים/אימונים שבועי.
   שינוי וחזרה למסך "היום" משנה את הפס המים.
5. **המתאמנים שלי (`/clients`)** — נירית רואה את "חברה (דמו)" כמתאמנת (קשר `coach_client` פעיל),
   ולחיצה פותחת `/clients/<id>`. מה שמוצג שם תלוי ב-PR-ים של תצוגות המאמנת (EC-38) — עד שהם
   ימוזגו, ה-RLS מגביל כל משתמש לנתונים של עצמו בלבד.
6. **החלפת משתמש** — התנתקו (כפתור יציאה), והתחברו עם האימייל של "חברה (דמו)". חוזרים על
   2–5: היא רואה את נירית כמתאמנת שלה (הקשר הדדי).

> הרשימה משקפת את מה שקיים ב-`main` נכון להיום. כשפיצ'רים חדשים ימוזגו ל-`staging`
> (תפריטים, כללי מאמן וכו') יש להוסיף להם שורה כאן.
