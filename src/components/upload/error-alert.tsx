import { Alert } from "@/components/ui/alert";

export interface ErrorAlertProps {
  message: string;
  title?: string;
}

/** A thin, semantically-named wrapper around Alert for inline form/page errors. */
export function ErrorAlert({ message, title }: ErrorAlertProps) {
  return (
    <Alert variant="danger" title={title}>
      {message}
    </Alert>
  );
}
