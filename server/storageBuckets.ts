import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Los depósitos de archivos, creados solos la primera vez que hacen falta.
 *
 * El código escribía en cinco depósitos de Supabase Storage y no había nada
 * —ni migración, ni script, ni una línea en la documentación— que los creara.
 * Funcionaban sólo si alguien se acordaba de darlos de alta a mano en el panel
 * de Supabase, y en un proyecto nuevo, o si alguien los borra, cada subida
 * muere con un error que el usuario lee como "esta aplicación está rota":
 * el logo de la empresa, las fotos de obra, los documentos, los adjuntos del
 * chat y los archivos de referencia del presupuesto. Cinco funciones caídas
 * por un paso de instalación que nadie escribió.
 *
 * Crearlos bajo demanda quita ese paso del todo. La operación es idempotente
 * y el resultado se recuerda, así que cuesta una llamada la primera vez y cero
 * a partir de ahí.
 */

/** Si la URL se entrega tal cual (público) o siempre firmada (privado). */
const BUCKETS = {
  // El generador de PDF vuelve a leer el logo meses después: una URL firmada
  // que caduca dejaría un documento archivado sin su propio membrete.
  "business-logos": { public: true },
  "project-photos": { public: false },
  "project-documents": { public: false },
  "estimate-references": { public: false },
  "chat-attachments": { public: false },
} as const;

export type BucketName = keyof typeof BUCKETS;

const ready = new Set<BucketName>();

/** Ya existe es el resultado normal, no un error. */
const ALREADY_THERE = /already exists|resource already exists|duplicate/i;

export async function ensureBucket(name: BucketName): Promise<void> {
  if (ready.has(name)) return;

  const admin = getSupabaseAdmin();
  const { error } = await admin.storage.createBucket(name, { public: BUCKETS[name].public });

  if (error && !ALREADY_THERE.test(error.message)) {
    // Crear depósitos exige la clave de servicio. Si falla por otra razón, que
    // se vea aquí y no tres pasos más abajo como "no se pudo subir el archivo".
    throw new Error(`no se pudo preparar el depósito "${name}": ${error.message}`);
  }

  ready.add(name);
}

/** Sólo para las pruebas: olvida lo aprendido. */
export function forgetBuckets(): void {
  ready.clear();
}
