import { PillNav } from '@/components/landing/PillNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <PillNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
