import { request } from './http'

export interface ImportedModel {
  _id: string
  name: string
}

/**
 * Stores a .glb file on the server. Importing the same file again gives back
 * the model it was first imported as.
 */
export async function uploadModel(file: File): Promise<ImportedModel> {
  const data = await request<{ model: ImportedModel }>(
    `/models?name=${encodeURIComponent(file.name)}`,
    { method: 'POST', body: file },
  )
  return data.model
}
