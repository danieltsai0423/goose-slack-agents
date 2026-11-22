import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';

const recentLimit = 6;

function folderError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function isDirectory(path) {
  return Boolean(statSync(path, { throwIfNoEntry: false })?.isDirectory());
}

// The modern Windows folder dialog (IFileOpenDialog + FOS_PICKFOLDERS), owned by a
// topmost window so it appears above the browser. Paths travel back on stdout only.
const windowsPickerScript = String.raw`
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class GooseFolderPicker {
  [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] class FileOpenDialog {}
  [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IFileDialog {
    [PreserveSig] int Show(IntPtr parent);
    void SetFileTypes(uint count, IntPtr types); void SetFileTypeIndex(uint index); void GetFileTypeIndex(out uint index);
    void Advise(IntPtr events, out uint cookie); void Unadvise(uint cookie);
    void SetOptions(uint options); void GetOptions(out uint options);
    void SetDefaultFolder(IShellItem item); void SetFolder(IShellItem item);
    void GetFolder(out IShellItem item); void GetCurrentSelection(out IShellItem item);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name); void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
    void GetResult(out IShellItem item);
  }
  [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItem {
    void BindToHandler(IntPtr bindContext, ref Guid handler, ref Guid riid, out IntPtr result);
    void GetParent(out IShellItem parent);
    void GetDisplayName(uint kind, [MarshalAs(UnmanagedType.LPWStr)] out string name);
  }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr bindContext, ref Guid riid, out IShellItem item);
  public static string Pick(IntPtr owner, string title, string start) {
    var dialog = (IFileDialog)new FileOpenDialog();
    uint options; dialog.GetOptions(out options);
    dialog.SetOptions(options | 0x20 | 0x40 | 0x800);
    dialog.SetTitle(title);
    if (!String.IsNullOrEmpty(start)) {
      try { var id = typeof(IShellItem).GUID; IShellItem folder; SHCreateItemFromParsingName(start, IntPtr.Zero, ref id, out folder); dialog.SetFolder(folder); } catch {}
    }
    if (dialog.Show(owner) != 0) return null;
    IShellItem result; dialog.GetResult(out result);
    string path; result.GetDisplayName(0x80058000, out path);
    return path;
  }
}
'@
$owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false; Opacity = 0; StartPosition = 'CenterScreen' }
$owner.Show(); $owner.Activate()
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$path = [GooseFolderPicker]::Pick($owner.Handle, $env:GOOSE_PICK_TITLE, $env:GOOSE_PICK_START)
$owner.Close()
if ($path) { [Console]::Out.Write($path) }
`;

function nativePicker() {
  if (process.platform !== 'win32') return null;
  const encoded = Buffer.from(windowsPickerScript, 'utf16le').toString('base64');
  return (start) => new Promise((accept, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encoded], {
      windowsHide: true, timeout: 10 * 60 * 1000,
      env: { ...process.env, GOOSE_PICK_START: start || '', GOOSE_PICK_TITLE: '選擇專案資料夾' }
    }, (error, stdout) => error ? reject(Object.assign(new Error('folder_picker'), { statusCode: 500 })) : accept(stdout.trim() || null));
  });
}

/**
 * Persists the owner's project folder choice for host-execution turns.
 * `current: null` means "no folder" and falls back to GOOSE_WORK_DIR.
 */
export function openOfficeFolders({ file, defaultDir, pick = nativePicker() }) {
  let state = { current: null, recent: [] };
  try {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    const recent = Array.isArray(saved.recent) ? saved.recent.filter(p => typeof p === 'string' && isAbsolute(p)) : [];
    state = { current: recent.includes(saved.current) ? saved.current : null, recent: recent.slice(0, recentLimit) };
  } catch {}
  let picking;

  function save() {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file + '.tmp', JSON.stringify(state, null, 2) + '\n');
    renameSync(file + '.tmp', file);
  }

  function snapshot() {
    return {
      current: state.current,
      defaultDir,
      canBrowse: Boolean(pick),
      recent: state.recent.map(path => ({ path, name: basename(path) || path, exists: isDirectory(path) }))
    };
  }

  function select(path) {
    if (path === null) {
      state = { ...state, current: null };
      save();
      return snapshot();
    }
    if (typeof path !== 'string' || !path.trim() || path.length > 1024 || !isAbsolute(path.trim())) {
      throw folderError('請選擇完整的資料夾路徑。');
    }
    const folder = resolve(path.trim());
    if (!isDirectory(folder)) throw folderError('找不到這個資料夾。', 404);
    const key = process.platform === 'win32' ? folder.toLowerCase() : folder;
    const others = state.recent.filter(p => (process.platform === 'win32' ? p.toLowerCase() : p) !== key);
    state = { current: folder, recent: [folder, ...others].slice(0, recentLimit) };
    save();
    return snapshot();
  }

  async function browse() {
    if (!pick) throw folderError('這台電腦不支援開啟資料夾對話框。', 501);
    if (picking) throw folderError('資料夾對話框已經開啟。', 409);
    picking = pick(state.current || defaultDir);
    try {
      const chosen = await picking;
      return chosen ? select(chosen) : { ...snapshot(), cancelled: true };
    } finally { picking = undefined; }
  }

  /** The folder a new submission should run in, or null for the default. */
  function forSubmission(requested) {
    if (requested === undefined) return state.current;
    if (requested === null) return null;
    if (typeof requested !== 'string' || !state.recent.includes(requested)) throw folderError('請從清單重新選擇專案資料夾。');
    if (!isDirectory(requested)) throw folderError('專案資料夾已不存在，請重新選擇。', 409);
    return requested;
  }

  return { snapshot, select, browse, forSubmission };
}
