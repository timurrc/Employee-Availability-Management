import { useParams } from "react-router-dom";
import { useDocument } from "@/hooks/useDocuments";

export const useDocumentPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: document, isPending, error } = useDocument(id);
  return { document, isPending, error };
};
