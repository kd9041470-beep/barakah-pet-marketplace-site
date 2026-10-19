# Barakah — Pet Marketplace Website

Public website deployment for the Barakah pet adoption and supplies marketplace.

The original application repository remains private. This repository contains the public frontend and the additive SQL migration needed for anonymous marketplace reports. No service role key or private application configuration is stored here.

## Marketplace behavior
- Visitors can publish a listing without creating an account. It becomes public immediately.
- The publisher must explicitly agree that the WhatsApp number will appear publicly.
- Visitors may report a listing or request its removal. Reports are private; only project administrators can read them in Supabase.
- Reports do not automatically remove a listing. Review the `market_listing_reports` table in the Supabase dashboard, then hide or remove the related listing manually.

## Supabase migration
The migration in `market-listing-reports.sql` was applied to project `3omda` (`ppuknuxgbdgufcbstiqq`). For a fresh environment, inspect and apply it only after creating `public.market_listings`.

## Deployment
GitHub Pages publishes this repository from the `main` branch.
