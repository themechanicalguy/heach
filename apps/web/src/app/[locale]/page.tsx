import { PageMessages } from '../../components/PageMessages';
import { HomeView } from '../../components/site/HomeView';
import { PublicHome } from '../../components/site/PublicHome';
import { PatientHome } from '../../components/site/PatientHome';
import { requestAudience } from '../../lib/request-audience';
import { siteConfig } from '../../lib/site-config';

export default async function HomePage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  const config = siteConfig();
  const joinOffered = (await requestAudience()) !== 'patient';
  return (
    <PageMessages>
      <HomeView
        publicHome={<PublicHome config={config} locale={locale} joinOffered={joinOffered} />}
        patientHome={<PatientHome config={config} locale={locale} />}
      />
    </PageMessages>
  );
}
