// 접속 프로필 편집 다이얼로그(plan §6-P1) — 순수 표현. 상태는 props, 실제 명령 호출은 배선.
// 비밀번호(plan §3.4): 마스킹 입력 + 'vault 저장됨' 정적 표시만. readback UI 는 없다.
//   - 새 비밀번호를 타이핑하면 onSave 의 draft.password 로만 흘려보낸다(여기서 되읽지 않는다).
//   - 이미 저장된 비밀이 있으면(hasStoredSecret) 정적 문구로 존재만 알린다 — 값은 절대 표시 안 함.
import { useEffect, useState } from 'react';
import type { ConnectionDialect, ConnectionEnvironment, ConnectionProfile } from '@/plugin/connections';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DialectIcon } from '@/components/connections/dialect';

// onSave 로 넘기는 초안 — 비밀 제외 프로필 메타 + (선택) 새 비밀번호. 배선이 프로필은 문서에,
// password 는 vault 에 나눠 저장한다. password 는 사용자가 타이핑했을 때만 존재한다.
export interface ConnectionDraft {
  id?: string;
  name: string;
  dialect: ConnectionDialect;
  environment: ConnectionEnvironment;
  readOnly: boolean;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  ssl?: boolean;
  file?: string;
  password?: string;
}

export interface ConnectionDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  // 편집 대상(있으면 편집, 없으면 새 프로필). 비밀은 절대 실리지 않는다.
  profile?: ConnectionProfile | null;
  // 편집 대상에 이미 vault 비밀이 저장돼 있는지(존재 여부만 — 값은 절대 넘어오지 않는다).
  hasStoredSecret?: boolean;
  onSave(draft: ConnectionDraft): void;
}

const DIALECTS: readonly ConnectionDialect[] = ['sqlite', 'mysql', 'postgresql'];
const ENVIRONMENTS: readonly ConnectionEnvironment[] = ['dev', 'staging', 'prod'];

const DEFAULT_PORT: Record<Exclude<ConnectionDialect, 'sqlite'>, number> = {
  mysql: 3306,
  postgresql: 5432,
};

interface FormState {
  name: string;
  dialect: ConnectionDialect;
  environment: ConnectionEnvironment;
  readOnly: boolean;
  host: string;
  port: string;
  database: string;
  user: string;
  ssl: boolean;
  file: string;
  password: string;
}

function initialForm(profile?: ConnectionProfile | null): FormState {
  return {
    name: profile?.name ?? '',
    dialect: profile?.dialect ?? 'postgresql',
    environment: profile?.environment ?? 'dev',
    readOnly: profile?.readOnly ?? false,
    host: profile?.host ?? '',
    port: profile?.port != null ? String(profile.port) : '',
    database: profile?.database ?? '',
    user: profile?.user ?? '',
    ssl: profile?.ssl ?? false,
    file: profile?.file ?? '',
    password: '',
  };
}

export function ConnectionDialog({
  open,
  onOpenChange,
  profile,
  hasStoredSecret = false,
  onSave,
}: ConnectionDialogProps) {
  const [form, setForm] = useState<FormState>(() => initialForm(profile));

  // 다이얼로그가 열릴 때(또는 편집 대상이 바뀔 때) 폼을 대상 값으로 리셋. 비밀번호는 항상 빈칸.
  useEffect(() => {
    if (open) setForm(initialForm(profile));
  }, [open, profile]);

  const isSqlite = form.dialect === 'sqlite';
  const canSave = form.name.trim().length > 0 && (isSqlite ? form.file.trim().length > 0 : true);

  function patch(updates: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  function handleSave() {
    if (!canSave) return;
    const draft: ConnectionDraft = {
      id: profile?.id,
      name: form.name.trim(),
      dialect: form.dialect,
      environment: form.environment,
      readOnly: form.readOnly,
    };
    if (isSqlite) {
      if (form.file.trim()) draft.file = form.file.trim();
    } else {
      if (form.host.trim()) draft.host = form.host.trim();
      const portNum = Number.parseInt(form.port, 10);
      if (Number.isFinite(portNum)) draft.port = portNum;
      if (form.database.trim()) draft.database = form.database.trim();
      if (form.user.trim()) draft.user = form.user.trim();
      draft.ssl = form.ssl;
    }
    // 비밀번호는 사용자가 타이핑했을 때만 실어 보낸다 — 빈칸이면 기존 vault 비밀을 건드리지 않는다.
    if (form.password.length > 0) draft.password = form.password;
    onSave(draft);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{profile ? 'Edit Connection' : 'New Connection'}</DialogTitle>
          <DialogDescription>
            Non-secret connection metadata. The password is stored in the vault, never here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 이름 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              data-node="conn-name"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="my-database"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* dialect */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Dialect</label>
              <Select
                value={form.dialect}
                onValueChange={(v) => patch({ dialect: v as ConnectionDialect })}
              >
                <SelectTrigger data-node="conn-dialect" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIALECTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      <DialectIcon dialect={d} />
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* environment */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Environment</label>
              <Select
                value={form.environment}
                onValueChange={(v) => patch({ environment: v as ConnectionEnvironment })}
              >
                <SelectTrigger data-node="conn-env" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* 접속 상세 — sqlite 는 파일, 그 외는 host/port/db/user */}
          {isSqlite ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Database file</label>
              <Input
                data-node="conn-file"
                value={form.file}
                onChange={(e) => patch({ file: e.target.value })}
                placeholder="/path/to/database.db"
                className="font-mono text-xs"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Host</label>
                  <Input
                    data-node="conn-host"
                    value={form.host}
                    onChange={(e) => patch({ host: e.target.value })}
                    placeholder="localhost"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="w-24 space-y-2">
                  <label className="text-sm font-medium">Port</label>
                  <Input
                    data-node="conn-port"
                    value={form.port}
                    onChange={(e) => patch({ port: e.target.value.replace(/[^0-9]/g, '') })}
                    inputMode="numeric"
                    placeholder={String(DEFAULT_PORT[form.dialect as 'mysql' | 'postgresql'])}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Database</label>
                  <Input
                    data-node="conn-database"
                    value={form.database}
                    onChange={(e) => patch({ database: e.target.value })}
                    placeholder="postgres"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">User</label>
                  <Input
                    data-node="conn-user"
                    value={form.user}
                    onChange={(e) => patch({ user: e.target.value })}
                    placeholder="postgres"
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <Checkbox
                  data-node="conn-ssl"
                  checked={form.ssl}
                  onCheckedChange={(c) => patch({ ssl: !!c })}
                />
                <span className="text-sm">Require SSL/TLS</span>
              </label>
            </div>
          )}

          {/* 비밀번호 — 마스킹 입력 + 'vault 저장됨' 정적 표시만. readback 없음(plan §3.4). */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => patch({ password: e.target.value })}
              placeholder={hasStoredSecret ? '••••••••  (stored in vault)' : 'Enter to store in vault'}
              autoComplete="new-password"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              {hasStoredSecret
                ? '이 프로필에는 vault 에 저장된 비밀번호가 있습니다. 새로 입력하면 교체됩니다(값은 표시되지 않습니다).'
                : '입력한 비밀번호는 vault 에만 저장되며 여기서 다시 읽을 수 없습니다.'}
            </p>
          </div>

          <Separator />

          {/* read-only 토글 */}
          <label className="flex items-center gap-2">
            <Checkbox
              data-node="conn-readonly"
              checked={form.readOnly}
              onCheckedChange={(c) => patch({ readOnly: !!c })}
            />
            <span className="text-sm">Open read-only</span>
          </label>
        </div>

        <DialogFooter>
          <Button data-node="conn-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button data-node="conn-save" onClick={handleSave} disabled={!canSave}>
            {profile ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
