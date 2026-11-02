import { PageMessages } from '../../../../components/PageMessages';
import { ProviderJoin } from '../../../../components/site/ProviderJoin';
import { serverFlags } from '../../../../lib/flags';

export default async function Page({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  return (
    <PageMessages>
      {<ProviderJoin locale={locale} accounts={serverFlags().isOn('accounts')} />}
    </PageMessages>
  );
}
