-- AD-09: seven new public pages, editable per language. Retain every existing page and override.
-- All columns keep their existing DC classifications; no patient or health data is introduced.
ALTER TABLE app.content_page DROP CONSTRAINT content_page_slug_check;
ALTER TABLE app.content_page ADD CONSTRAINT content_page_slug_check CHECK (
  slug IN ('terms', 'privacy', 'faq', 'refunds', 'about', 'verification', 'areas',
           'contact', 'grievance', 'provider-agreement', 'patient-rights')
);
