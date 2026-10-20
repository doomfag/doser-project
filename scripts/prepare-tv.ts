import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir("tv/apple/Resources", { recursive: true });
await copyFile(
  "build-native/seed/catalog.json",
  "tv/apple/Resources/catalog.json",
);
for (const platform of ["webos", "tizen"]) {
  const directory = `build-tv/${platform}`;
  await mkdir(directory, { recursive: true });
  const result = spawnSync(
    process.execPath,
    ["scripts/portable.ts", `${directory}/index.html`, "--native-json", "--tv"],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  const htmlPath = `${directory}/index.html`;
  const html = await readFile(htmlPath, "utf8");
  const body = html.lastIndexOf("<body>");
  if (body < 0) throw new Error("Documento de TV sem corpo HTML.");
  const notice =
    '<p id="doser-platform-notice" style="padding:40px;font:24px sans-serif">Carregando Doser. Se esta mensagem permanecer, o motor web deste modelo pode não ser compatível. Pacote inicial para validação em TVs recentes.</p>';
  await writeFile(
    htmlPath,
    html.slice(0, body + 6) + notice + html.slice(body + 6),
  );
  await copyFile("desktop/icon-80.png", `${directory}/icon.png`);
  await copyFile("desktop/icon-130.png", `${directory}/large-icon.png`);
}
await writeFile(
  "build-tv/webos/appinfo.json",
  JSON.stringify(
    {
      id: "io.github.doomfag.doser.tv",
      version: "0.6.0",
      type: "web",
      main: "index.html",
      title: "Doser",
      icon: "icon.png",
      largeIcon: "large-icon.png",
      vendor: "Doser",
      resolution: "1920x1080",
      bgColor: "#14261E",
    },
    null,
    2,
  ),
);
await writeFile(
  "build-tv/tizen/config.xml",
  `<?xml version="1.0" encoding="UTF-8"?><widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="https://github.com/doomfag/doser-project" version="0.6.0" viewmodes="maximized"><tizen:application id="DoserTV001.Doser" package="DoserTV001" required_version="6.5"/><content src="index.html"/><icon src="icon.png"/><name>Doser</name><tizen:profile name="tv-samsung"/><feature name="http://tizen.org/feature/screen.size.normal.1080.1920"/><tizen:setting screen-orientation="landscape" context-menu="disable" background-support="disable" encryption="disable" install-location="auto" hwkey-event="enable"/><access origin="https://*" subdomains="true"/></widget>`,
);
await writeFile(
  "build-tv/tizen/LEIA-ME.txt",
  "Projeto Samsung Tizen TV. Não é pacote assinado ou instalável. Abra no Tizen Studio, use seu certificado Samsung TV e exporte o WGT. Teste a versão do motor web da TV antes de instalar. Não há garantia de compatibilidade com modelos antigos.\n",
);
console.log(
  "Recursos de Apple TV, webOS e Tizen preparados. Certificados e teste de hardware são etapas separadas.",
);
