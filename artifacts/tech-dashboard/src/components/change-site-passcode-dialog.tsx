import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ChangeSitePasscodeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setNewPasscode("");
    setConfirmPasscode("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPasscode !== confirmPasscode) {
      toast({ title: "Passcodes don't match", variant: "destructive" });
      return;
    }
    if (newPasscode.length < 4) {
      toast({ title: "Passcode must be at least 4 characters", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${basePath}/api/admin/passcode`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPasscode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      toast({
        title: "Site passcode updated",
        description: "Existing browser sessions stay unlocked. New visitors need the new passcode.",
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Couldn't update passcode",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change site passcode</DialogTitle>
          <DialogDescription>
            Anyone visiting the dashboard will need this passcode to get past the gate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">New passcode</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value)}
              required
              minLength={4}
              data-testid="change-site-passcode-new"
            />
            <p className="text-xs text-muted-foreground">At least 4 characters.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Confirm passcode</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPasscode}
              onChange={(e) => setConfirmPasscode(e.target.value)}
              required
              minLength={4}
              data-testid="change-site-passcode-confirm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} data-testid="change-site-passcode-submit">
              {submitting ? "Saving…" : "Update passcode"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
