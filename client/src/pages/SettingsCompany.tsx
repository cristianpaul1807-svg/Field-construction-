import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Check, Upload, Trash2, Copy } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, apiFetch, serverMessage } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useNombresDelMenu } from "@/lib/nombresDelMenu";
import { AvisoDeFallo } from "@/components/AvisoDeFallo";
import { PAISES, paisDe, aplicaLaCcq } from "@shared/paises";

interface CompanyData {
  id: string;
  name: string;
  slug: string;
  licenseNumber: string;
  taxConfig: { region?: string; rate?: number };
  country: string;
  province: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  qstNumber: string | null;
  holdbackPercent: number;
  estimateTerms: string | null;
  logoUrl: string | null;
  estimateShowMaterials: boolean;
  estimateShowSchedule: boolean;
  ccqEmployerNumber: string | null;
  ccqSubject: boolean;
}

interface TaxRate {
  province: string;
  label: string;
  isHst: boolean;
  gstRate: number;
  pstRate: number;
  hstRate: number;
}

/** Cómo se llama el impuesto en cada sitio, con el porcentaje que se cobra.
 *  En Quebec son dos y se declaran por separado; en Ontario es uno solo. */
function describeTax(r: TaxRate) {
  const pct = (n: number) => `${Number((n * 100).toFixed(3))} %`;
  if (r.isHst) return `TVH/HST ${pct(r.hstRate)}`;
  const partes = [`TPS/GST ${pct(r.gstRate)}`];
  if (r.pstRate > 0) partes.push(r.province === "QC" ? `TVQ/QST ${pct(r.pstRate)}` : `PST ${pct(r.pstRate)}`);
  return partes.join(" + ");
}

export default function SettingsCompany() {
  const { t } = useTranslation();
  const menuNombres = useNombresDelMenu();
  const { data, loading, error, reload, detalle } = useApi<CompanyData>("/api/settings/company");
  const { data: taxRates } = useApi<TaxRate[]>("/api/canada-tax-rates");
  const [name, setName] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [license, setLicense] = useState("");
  const [country, setCountry] = useState("CA");
  const [province, setProvince] = useState("");
  // Lo que se le pide sale de aquí y no de una lista escrita en la pantalla:
  // los números de TPS/TVQ, la licencia RBQ y la CCQ son de Canadá.
  const pais = paisDe(country);
  const tasaElegida = (taxRates ?? []).find((r) => r.province === province) ?? null;
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [qstNumber, setQstNumber] = useState("");
  const [ccqNumber, setCcqNumber] = useState("");
  const [ccqSubject, setCcqSubject] = useState(false);
  const [holdbackPercent, setHoldbackPercent] = useState("0");
  const [estimateTerms, setEstimateTerms] = useState("");
  const [showMaterials, setShowMaterials] = useState(true);
  const [showSchedule, setShowSchedule] = useState(true);
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
      if (!res.ok) throw new Error(serverMessage(await res.json().catch(() => null), t, t("common.genericError")));
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
    setLicense(data.licenseNumber ?? "");
    setCountry(data.country ?? "CA");
    setProvince(data.province ?? "");
    setAddress(data.address ?? "");
    setPhone(data.phone ?? "");
    setEmail(data.email ?? "");
    setGstNumber(data.gstNumber ?? "");
    setQstNumber(data.qstNumber ?? "");
    setHoldbackPercent(String(data.holdbackPercent ?? 0));
    setEstimateTerms(data.estimateTerms ?? "");
    setShowMaterials(data.estimateShowMaterials !== false);
    setShowSchedule(data.estimateShowSchedule !== false);
    setCcqNumber(data.ccqEmployerNumber ?? "");
    setCcqSubject(data.ccqSubject === true);
  }, [data]);

  // El link entero y no sólo el trozo final: es lo que el negocio va a pegar
  // en su bio de Instagram o en WhatsApp, y nadie lo arma a mano.
  const linkPublico = data?.slug ? `${window.location.origin}/c/${data.slug}` : "";

  const copiarLink = async () => {
    if (!linkPublico) return;
    await navigator.clipboard.writeText(linkPublico);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          licenseNumber: license,
          country,
          address,
          phone,
          email,
          gstNumber,
          qstNumber,
          holdbackPercent: holdbackPercent === "" ? 0 : Number(holdbackPercent),
          estimateTerms,
          estimateShowMaterials: showMaterials,
          estimateShowSchedule: showSchedule,
          ccqEmployerNumber: ccqNumber,
          ccqSubject,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(serverMessage(body, t, t("common.genericError")));
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
        <AvisoDeFallo
          mensaje={t("common.loadError", { message: error })}
          detalle={detalle}
          onReintentar={reload}
        />
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
                <Label htmlFor="country">{t("settings.country")}</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger id="country"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAISES.map((p) => (
                      <SelectItem key={p.codigo} value={p.codigo}>{t(`countries.name.${p.codigo}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Sólo se ofrece lo que sabemos hacer entero. Dejar elegir un
                    país para el que no calculamos el impuesto sería darle a
                    alguien facturas mal hechas con aspecto de correctas. */}
                <p className="text-xs text-muted-foreground">{t("settings.countryHint")}</p>
              </div>
              {pais.licencia && (
                <div className="space-y-1.5">
                  <Label htmlFor="license">{t(pais.licencia.etiqueta)}</Label>
                  <Input
                    id="license"
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                    placeholder={pais.licencia.ejemplo}
                  />
                </div>
              )}
              {/* Se enseña, no se edita. Era un campo libre con un cartel rojo
                  debajo avisando de que cambiarlo rompe los links ya
                  compartidos: el enlace está en el chat público, en el mensaje
                  de bienvenida de WhatsApp y en cada sitio donde el negocio lo
                  haya pegado. Un control cuyo único aviso es «esto te va a
                  romper algo» no es una opción, es una trampa.

                  Lo genera el sistema con el nombre del negocio al darse de
                  alta. Si alguna vez hay que cambiarlo de verdad, lo hacemos
                  nosotros: la ruta lo sigue aceptando y comprueba que no lo
                  tenga otro. */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="slug">{t("settings.publicLinkAutomations")}</Label>
                <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                  <Input
                    id="slug"
                    readOnly
                    value={linkPublico}
                    className="font-mono text-xs truncate break-all flex-1 min-w-0"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 flex-shrink-0"
                    onClick={copiarLink}
                    disabled={!linkPublico}
                  >
                    {copiado ? <Check size={15} strokeWidth={1.75} /> : <Copy size={15} strokeWidth={1.75} />}
                    {copiado ? t("invoicing.copied") : t("common.copy")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("settings.publicLinkFixed")}</p>
              </div>
              {/* Aquí había una casilla de texto libre y un porcentaje a mano
                  que no leía nadie: vivían en tax_config, mientras la factura
                  saca el impuesto de businesses.province contra la tabla de
                  tasas de Canadá. Un contratista de Ontario escribía "Ontario"
                  y "13", se quedaba tranquilo, y sus facturas salían con TPS y
                  TVQ de Quebec.
                  
                  Se enseña, pero no se edita: la provincia ya se elige en
                  Ajustes → Pagos, junto al resto de lo que decide cuánto se
                  cobra. Dos sitios para cambiar un dato que acaba en un
                  documento legal es uno de más. */}
              <div className="space-y-1.5 sm:col-span-2">
                <p className="text-sm font-medium text-foreground">{t("settings.province")}</p>
                <p className="text-sm text-muted-foreground">
                  {tasaElegida ? `${tasaElegida.label} — ${describeTax(tasaElegida)}` : t("settings.provinceHint")}
                </p>
                <Link href="/settings/payments" className="text-xs text-primary hover:underline">
                  {t("settings.provinceChangeHere", menuNombres)}
                </Link>
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
              {pais.identificadoresFiscales.map((id) => (
                <div key={id.campo} className="space-y-1.5">
                  <Label htmlFor={id.campo}>{t(id.etiqueta)}</Label>
                  <Input
                    id={id.campo}
                    value={id.campo === "gst" ? gstNumber : qstNumber}
                    onChange={(e) => (id.campo === "gst" ? setGstNumber : setQstNumber)(e.target.value)}
                    placeholder={id.ejemplo}
                  />
                </div>
              ))}
              {/* La CCQ. Sólo en Quebec: en el resto de Canadá no existe, y
                  un campo que no le toca a nadie es ruido permanente. */}
              {aplicaLaCcq(country, province) && (
                <div className="sm:col-span-2 space-y-2 rounded-lg border border-border p-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox checked={ccqSubject} onCheckedChange={(v) => setCcqSubject(v === true)} />
                    <span className="min-w-0">
                      <span className="block text-sm text-foreground">{t("settings.ccqSubject")}</span>
                      <span className="block text-xs text-muted-foreground">{t("settings.ccqSubjectHint")}</span>
                    </span>
                  </label>
                  {ccqSubject && (
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="ccq">{t("settings.ccqEmployerNumber")}</Label>
                      <Input
                        id="ccq"
                        className="sm:max-w-xs"
                        value={ccqNumber}
                        onChange={(e) => setCcqNumber(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">{t("settings.ccqEmployerNumberHint")}</p>
                    </div>
                  )}
                </div>
              )}

              {pais.retencion && (
              <div className="space-y-1.5">
                <Label htmlFor="holdback">{t("settings.holdbackPercent")}</Label>
                <Input
                  id="holdback"
                  type="number"
                  min={0}
                  max={20}
                  step="0.5"
                  value={holdbackPercent}
                  onChange={(e) => setHoldbackPercent(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("settings.holdbackPercentHint")}</p>
                {/* Un número alto aquí no da error: da facturas por menos
                    dinero del que toca, y eso no se nota hasta que el cliente
                    paga. Por encima del 10 % se avisa en pantalla. */}
                {Number(holdbackPercent) > 10 && (
                  <p className="text-xs text-status-warning-fg">
                    {t("settings.holdbackTooHigh", { percent: Number(holdbackPercent) })}
                  </p>
                )}
              </div>
              )}
              {/* Both sections are built from data the estimate already
                  holds, so turning them on costs nothing to maintain — and
                  they are what a customer reads before signing. */}
              <div className="sm:col-span-2 space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">{t("settings.estimateSections")}</p>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox checked={showMaterials} onCheckedChange={(v) => setShowMaterials(v === true)} className="mt-0.5" />
                  <span>
                    <span className="block text-sm text-foreground">{t("settings.showMaterials")}</span>
                    <span className="block text-xs text-muted-foreground">{t("settings.showMaterialsHint")}</span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox checked={showSchedule} onCheckedChange={(v) => setShowSchedule(v === true)} className="mt-0.5" />
                  <span>
                    <span className="block text-sm text-foreground">{t("settings.showSchedule")}</span>
                    <span className="block text-xs text-muted-foreground">{t("settings.showScheduleHint")}</span>
                  </span>
                </label>
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
