import React from "react";

export interface AddNovelDialogProps {
  isOpen: boolean;
  isSubmitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (url: string) => void | Promise<void>;
}

export const AddNovelDialog: React.FC<AddNovelDialogProps> = () => {
  return null;
};
