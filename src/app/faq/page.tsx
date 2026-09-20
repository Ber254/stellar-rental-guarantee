import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { Card } from "@/components/ui";

export default async function FaqPage() {
  const t = getDictionary(await getLocale());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-fg">{t.faq.title}</h1>
      <div className="space-y-3">
        {t.faq.items.map((item) => (
          <Card key={item.q} title={item.q}>
            <p className="text-sm text-muted">{item.a}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
