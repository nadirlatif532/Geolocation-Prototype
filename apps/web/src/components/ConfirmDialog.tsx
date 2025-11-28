interface ConfirmDialogProps {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md mx-4 shadow-2xl">
                <h3 className="text-xl font-bold mb-3">{title}</h3>
                <p className="text-muted-foreground mb-6">{message}</p>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        Confirm Respawn
                    </button>
                </div>
            </div>
        </div>
    );
}
