import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Check, Upload, Trash2 } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface CompanyData {
  id: string;
  name: string;
  slug: string;
  licenseNumber: string;
  taxConfig: { region?: string; rate?: number };
  address: string | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  qstNumber: string | null;
  depositPercent: number;
  holdbackPercent: number;
  estimateTerms: string | null;
  logoUrl: string | null;
}

export default function SettingsCompany() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useApi<CompanyData>("/api/settings/company");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [license, setLicense] = useState("");
  const [region, setRegion] = useState("");
  const [rate, setRate] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [qstNumber, setQstNumber] = useState("");
  const [depositPercent, setDepositPercent] = useState("30");
  const [holdbackPercent, setHoldbackPercent] = useState("0");
  const [estimateTerms, setEstimateTerms] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  const uploadLogo = async (file: File) => {
    setLogoBusy(true);
    setSaveError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      // No Content-Type header: the browser has to set the multipart boundary
      // itself, and naming the type by hand is what breaks these uploads.
      const res = await apiFetch("/api/settings/logo", { method: "POST", body });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || t("common.genericError"));
      reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    try {
      const res = await apiFetch("/api/settings/logo", { method: "DELETE" });
      if (res.ok) reload();
    } finally {
      setLogoBusy(false);
    }
  };

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setSlug(data.slug ?? "");
    setLicense(data.licenseNumber ?? "");
    setRegion(data.taxConfig?.region ?? "");
    setRate(data.taxConfig?.rate ? String(data.taxConfig.rate * 100) : "");
    setAddress(data.address ?? "");
    setPhone(data.phone ?? "");
    setEmail(data.email ?? "");
    setGstNumber(data.gstNumber ?? "");
    setQstNumber(data.qstNumber ?? "");
    setDepositPercent(String(data.depositPercent ?? 30));
    setHoldbackPercent(String(data.holdbackPercent ?? 0));
    setEstimateTerms(data.estimateTerms ?? "");
  }, [data]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          licenseNumber: license,
          taxConfig: { region, rate: rate ? Number(rate) / 100 : undefined },
          address,
          phone,
          email,
          gstNumber,
          qstNumber,
          depositPercent: depositPercent === "" ? 0 : Number(depositPercent),
          holdbackPercent: holdbackPercent === "" ? 0 : Number(holdbackPercent),
          estimateTerms,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || t("common.genericError"));
      }
      reload();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title={t("settings.companyTitle")} description={t("settings.companyDescriptionFull")} />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          {t("common.loadError", { message: error })}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-4">
              {data.logoUrl ? (
                <img
                  src={data.logoUrl}
                  alt={data.name}
                  className="w-16 h-16 rounded-xl object-contain border border-border bg-card"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
                  {data.name.charAt(0)}
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLogo(file);
                      e.target.value = "";
                    }}
                  />
                  <Button variant="outline" size="sm" className="gap-2" disabled={logoBusy} onClick={() => logoInput.current?.click()}>
                    {logoBusy ? <Spinner className="size-3.5" /> : <Upload size={14} strokeWidth={1.75} />}
                    {t("settings.changeLogo")}
                  </Button>
                  {data.logoUrl && (
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" disabled={logoBusy} onClick={removeLogo}>
                      <Trash2 size={14} strokeWidth={1.75} /> {t("common.delete")}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t("settings.logoHint")}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("settings.businessName")}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="license">{t("settings.licenseNumber")}</Label>
                <Input id="license" value={license} onChange={(e) => setLicense(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="slug">{t("settings.publicLinkAutomations")}</Label>
                <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
                <p className="text-xs text-status-warning-fg">{t("settings.slugWarning")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="region">{t("settings.province")}</Label>
                <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate">{t("settings.taxRate")}</Label>
                <Input id="rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
            </div>
          </Card>

          {/* Everything in this card is what gets printed at the top of every
              estimate and invoice. In Quebec the GST/QST registration numbers
              are not optional on an invoice — leaving them blank produces a
              document the customer's accountant will send back. */}
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t("settings.billingIdentity")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("settings.billingIdentityHint")}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address">{t("common.address")}</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t("settings.addressPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company-phone">{t("common.phone")}</Label>
                <Input id="company-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company-email">{t("common.email")}</Label>
                <Input id="company-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gst">{t("settings.gstNumber")}</Label>
                <Input
                  id="gst"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="123456789 RT0001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qst">{t("settings.qstNumber")}</Label>
                <Input
                  id="qst"
                  value={qstNumber}
                  onChange={(e) => setQstNumber(e.target.value)}
                  placeholder="1234567890 TQ0001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deposit">{t("settings.depositPercent")}</Label>
                <Input
                  id="deposit"
                  type="number"
                  min={0}
                  max={100}
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("settings.depositPercentHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="holdback">{t("settings.holdbackPercent")}</Label>
                <Input
                  id="holdback"
                  type="number"
                  min={0}
                  max={100}
                  value={holdbackPercent}
                  onChange={(e) => setHoldbackPercent(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("settings.holdbackPercentHint")}</p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="terms">{t("settings.estimateTerms")}</Label>
                <Textarea
                  id="terms"
                  rows={3}
                  value={estimateTerms}
                  onChange={(e) => setEstimateTerms(e.target.value)}
                  placeholder={t("settings.estimateTermsPlaceholder")}
                />
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-end gap-3">
            {saveError && <p className="text-sm text-status-error-fg">{saveError}</p>}
            <Button className="gap-2" onClick={save} disabled={saving}>
              {saved && <Check size={16} />}
              {saved ? t("common.saved") : t("settings.saveChanges")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
