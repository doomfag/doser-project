"""Empacota recursos já compilados e um runtime oficial previamente verificado."""
import hashlib,json,pathlib,sys,zipfile
root=pathlib.Path(__file__).resolve().parent.parent
runtime_zip=pathlib.Path(sys.argv[1]);metadata=json.loads(pathlib.Path(sys.argv[2]).read_text())
if hashlib.sha256(runtime_zip.read_bytes()).hexdigest()!=metadata['sha256']:raise RuntimeError('O runtime não corresponde ao checksum oficial registrado.')
output=root/'releases'/'Doser-Windows-x64.zip';output.parent.mkdir(exist_ok=True)
folder='Doser/'
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
 for relative in ['dist','server','src/domain','data/clinical','node_modules/csv-parse']:
  for file in (root/relative).rglob('*'):
   if file.is_file() and not file.name.endswith('.test.ts'):archive.write(file,folder+str(file.relative_to(root)))
 archive.write(root/'.doser/catalog.json',folder+'.doser/catalog.json')
 archive.writestr(folder+'package.json',json.dumps({'name':'doser-local','private':True,'type':'module','version':'0.4.0'}))
 with zipfile.ZipFile(runtime_zip) as runtime:
  base=f"node-{metadata['version']}-win-x64/"
  archive.writestr(folder+'runtime/node.exe',runtime.read(base+'node.exe'))
  archive.writestr(folder+'runtime/LICENSE',runtime.read(base+'LICENSE'))
 archive.writestr(folder+'runtime/proveniencia.json',json.dumps(metadata,indent=2))
 archive.writestr(folder+'Iniciar Doser.cmd',('@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\nset "DOSER_OPEN_BROWSER=1"\r\n"%~dp0runtime\\node.exe" --use-env-proxy server/index.ts\r\nif errorlevel 1 pause\r\n').encode('ascii'))
 archive.writestr(folder+'LEIA-ME.txt',('DOSER - PACOTE PORTATIL PARA WINDOWS X64\r\n\r\n1. Extraia TODO o ZIP para uma pasta.\r\n2. Abra Iniciar Doser.cmd.\r\n3. O navegador abre automaticamente. Mantenha a janela do programa aberta.\r\n4. Para encerrar, feche a janela ou pressione Ctrl+C.\r\n\r\nNao precisa instalar Node.js nem contratar hospedagem. Use Windows 10/11 x64.\r\nA base inclui 10.326 registros ativos unicos consultados na Anvisa em 20/10/2026.\r\nA consulta cadastral funciona sem internet. Atualizar a base e abrir bulas exigem internet.\r\nInclui referencias PCDT separadas para hipertensao e diabete tipo 2 em adultos. Nao substituem bulas das apresentacoes.\r\nCalculadora converte apenas doses ja prescritas; nao seleciona tratamentos.\r\nAs anotacoes e favoritos ficam no navegador deste computador, sem sincronizacao. Exporte copias em Dados e ajustes.\r\n\r\nO servidor, a base real e os fluxos web foram testados em Linux. O executavel Node oficial teve checksum verificado. O iniciador Windows e o funcionamento em Windows real ainda precisam ser testados.\r\nNao e um instalador Tauri nem um APK Android.\r\n').encode('ascii'))
 archive.writestr(folder+'FONTES.txt',('Fonte cadastral: https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv\r\nSHA256: f0b546e2d3a737a90fbc866348356cd766344bd2f4b8f488a43d66a0d7a30877\r\nBulA: https://consultas.anvisa.gov.br/#/bulario/\r\nConsulta pessoal e academica. Registro ativo na data da fonte nao garante comercializacao ou estoque.\r\nO runtime Node.js e csv-parse mantem suas licencas nas respectivas pastas.\r\n').encode('ascii'))
print(json.dumps({'file':str(output),'bytes':output.stat().st_size,'runtime':metadata['version'],'sha256':hashlib.sha256(output.read_bytes()).hexdigest()},indent=2))
