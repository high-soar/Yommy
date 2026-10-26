import React from "react";

export interface DeleteConfirmDialogProps {
  isOpen: boolean;
  novelTitle: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = () => {
  return null;
};
