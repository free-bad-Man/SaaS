import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

function storagePath(root, key) {
  const base = resolve(root);
  const target = resolve(base, key);
  if (target !== base && !target.startsWith(`${base}${sep}`)) throw new Error("Invalid upload storage key.");
  return target;
}

export function createLocalUploadStorage(root) {
  if (!root) throw new Error("UPLOAD_DIR is required for local upload storage.");
  return {
    async put(key, value) {
      const target = storagePath(root, key);
      const temporary = `${target}.${crypto.randomUUID()}.tmp`;
      await mkdir(dirname(target), { recursive: true });
      await writeFile(temporary, value, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, target);
    },
    async get(key) {
      const target = storagePath(root, key);
      try {
        const value = await readFile(target, "utf8");
        return { async text() { return value; } };
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(key) {
      await rm(storagePath(root, key), { force: true });
    },
  };
}

