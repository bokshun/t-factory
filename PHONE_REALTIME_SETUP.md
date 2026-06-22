# Phone and real-time setup

## What works now

This app is now a browser-installable web app. Once it is hosted on an HTTPS URL, open that URL on your phone and use **Add to Home Screen**.

The app still stores operational data in the browser on each device. That means tasks, photos, time logs, and messages do not sync across phones yet.

## What is needed for real-time team use

To make the team see the same live data, the app needs:

- a hosted web URL
- user sign-in
- a cloud database for tasks, reminders, messages, schedules, and time entries
- cloud file storage for uploaded photos
- real-time subscriptions so team phones update automatically

## Recommended next build step

Use Supabase or Firebase as the backend. Supabase is a good fit because it provides authentication, database tables, photo storage, and real-time updates in one place.

The app will need these backend settings:

- project URL
- public anon key
- storage bucket name for photos

Do not put private service-role keys in this frontend app.

## Phone install steps after hosting

1. Open the hosted app URL on the phone.
2. iPhone: tap Share, then Add to Home Screen.
3. Android: open the browser menu, then Add to Home screen.
4. Sign in once real-time sync is connected.
