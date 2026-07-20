// Wiring for the Connections surface (plan §6-P1). Subscribes the connections store for the
// profile list, opens the add/edit dialog, and turns intents into commands: onSave →
// db-profile-add, onSelect → session.select (which db-connects). The presentation components
// (ConnectionsPanel / ConnectionDialog) never touch a command themselves.
import { useState } from 'react';
import { toast } from '@/store/toast-store';
import { ConnectionsPanel } from '@/components/connections/ConnectionsPanel';
import { ConnectionDialog, type ConnectionDraft } from '@/components/connections/ConnectionDialog';
import { useDbHost, useConnectionProfiles } from '@/components/host/db-host';
import type { DbHost } from '@/components/host/db-host';

// ConnectionDraft (non-secret meta + optional password) → db-profile-add params. The password
// is dropped here — db-profile-add rejects secrets (they are the vault's domain, plan §3.4).
function draftToProfileParams(draft: ConnectionDraft): Record<string, unknown> {
  const p: Record<string, unknown> = {
    name: draft.name,
    dialect: draft.dialect,
    environment: draft.environment,
    readOnly: draft.readOnly,
  };
  if (draft.id) p.id = draft.id;
  if (draft.host) p.host = draft.host;
  if (draft.port != null) p.port = draft.port;
  if (draft.database) p.database = draft.database;
  if (draft.user) p.user = draft.user;
  if (draft.ssl != null) p.ssl = draft.ssl;
  if (draft.file) p.file = draft.file;
  return p;
}

function Inner({ host }: { host: DbHost }) {
  const profiles = useConnectionProfiles(host.connStore);
  const [dialogOpen, setDialogOpen] = useState(false);

  const onSave = async (draft: ConnectionDraft) => {
    const out = await host.run('db-profile-add', draftToProfileParams(draft));
    if (!out.ok) {
      toast(out.message ?? '프로필 추가 실패', 'error');
      return;
    }
    setDialogOpen(false);
    toast(`프로필 '${draft.name}' 을 추가했습니다`, 'success');
  };

  return (
    <>
      <ConnectionsPanel
        profiles={profiles}
        statuses={host.session.statuses}
        selectedId={host.session.selectedProfileId}
        onAdd={() => setDialogOpen(true)}
        onSelect={host.session.select}
      />
      <ConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={onSave} />
    </>
  );
}

export function ConnectionsContainer() {
  const host = useDbHost();
  if (!host || !host.live) return null;
  return <Inner host={host} />;
}
