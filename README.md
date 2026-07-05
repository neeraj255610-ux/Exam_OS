# ExamOS — Self-Running Exam Prep

A daily-schedule engine + dashboard + subject-wise mock tests, built so you never have to
decide "what do I study today." Works for any exam — you configure it once via Excel upload.

## What it does

- **Auto-generated daily plan**: upload your syllabus once (subject, topic, book, page range,
  time estimate, priority) and it slices your whole syllabus into daily sessions between
  today and your exam date.
- **Auto-shift on missed days**: if you don't mark a day's topics done, they roll forward and
  get redistributed into your remaining days automatically — nothing is lost, nothing needs
  manual rescheduling.
- **Spaced-repetition revisions**: finishing a topic auto-schedules revisions at +1, +3, +7,
  +15 days. Overdue ones surface as "missed revisions" and stay in your queue until done.
- **Dashboard**: streak, days left, Preparation Efficiency Score, syllabus %, today's target,
  revision completion %, due-today count, missed revisions, productivity.
- **Mock tests**: upload your own question bank (Excel) per subject, take a CBT-style timed
  test (question palette, one at a time), see your score, and it feeds back into your
  Efficiency Score.

## 1. Create a Supabase project (free tier is enough)

1. Go to https://supabase.com -> New project.
2. Once created, go to **SQL Editor** -> paste the contents of `supabase/schema.sql` -> Run.
3. Go to **Project Settings -> API** -> copy the **Project URL** and **anon public key**.
4. Go to **Authentication -> Providers** -> make sure **Email** is enabled (it is by default).
   For your own personal use, you can turn off "Confirm email" under
   Authentication -> Settings, so signup logs you straight in.

## 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the two values from step 1:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run locally to test

```bash
npm install
npm run dev
```

Open the printed localhost URL, sign up with an email/password, and you'll land on the setup
screen.

## 4. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

When prompted, add the same two environment variables (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) in the Vercel project settings -> Environment Variables, then redeploy
(`vercel --prod`). Since this is a static Vite build, no server config is needed — Vercel
detects it automatically.

Your friend can use the same deployed app with their own email/password login — Supabase Row
Level Security keeps each person's data (syllabus, schedule, scores) completely separate.

## 5. Using it day to day

1. **First time**: fill `public/syllabus_template.xlsx` (downloadable from the setup screen)
   with your subjects/topics/pages/time estimates, set your exam date and daily study minutes,
   upload it. Your full schedule is generated instantly.
2. **Today tab**: shows exactly what to study today (subject, topic, book, page range) plus any
   revisions due. Tap the circle to mark done — this schedules its future revisions
   automatically.
3. **Missed a day?** Just open the app and hit "Resync Schedule" (or it auto-syncs on load) —
   unfinished topics shift into upcoming days automatically.
4. **Mock Test tab**: upload `public/question_bank_template.xlsx` filled with questions per
   subject, then take a timed CBT-style test any time — from Today, tapping "Mock test" next to
   a topic jumps straight to that subject's test.
5. **Settings**: adjust daily study capacity or subject priority (how often a subject shows up
   in your daily mix) any time — it resyncs the schedule when you save.

## Notes on the scoring

The **Preparation Efficiency Score** is a composite the app calculates for motivation/tracking,
not an official exam metric:
`40% pace-vs-plan + 25% revision adherence + 20% streak + 15% recent mock test average`.
You can see/adjust the weighting logic in `src/lib/metrics.ts` if you want to tune it.
