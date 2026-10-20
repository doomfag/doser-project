import SwiftUI

struct DocumentarySource: Decodable {let title:String;let url:String;let checkedAt:String;let version:String;let status:String}
struct DocumentaryFact:Decodable {let text:String;let source:DocumentarySource}
struct Regimen:Decodable,Identifiable {let id:String;let presentation:String;let population:String;let dose:String;let doseBasis:String?;let interval:String?;let age:String?;let route:String?;let maxDaily:String?;let conditions:String?;let source:DocumentarySource}
struct Medicine:Decodable,Identifiable {let id:String;let name:String;let ingredient:String;let drugClass:String;let aliases:[String];let clinicalReferenceIds:[String]?;let facts:[String:DocumentaryFact]}
struct ClinicalReference:Decodable,Identifiable {let id:String;let subject:String;let ingredients:[String];let scope:String;let issues:[String]?;let facts:[String:DocumentaryFact];let usage:[Regimen];let source:DocumentarySource}
struct Catalog:Decodable {let medicines:[Medicine];let clinicalReferences:[ClinicalReference]}
func normalized(_ value:String)->String {value.folding(options:[.diacriticInsensitive,.caseInsensitive],locale:Locale(identifier:"pt_BR")).lowercased()}
@MainActor final class Library:ObservableObject {
 @Published var medicines:[Medicine]=[]
 @Published var references:[ClinicalReference]=[]
 @Published var error:String?
 @Published var favorites:Set<String>=Set(UserDefaults.standard.stringArray(forKey:"doser.favorites") ?? [])
 private var index:[String:String]=[:]
 init(){do{guard let url=Bundle.main.url(forResource:"catalog",withExtension:"json") else {throw CocoaError(.fileNoSuchFile)};let catalog=try JSONDecoder().decode(Catalog.self,from:Data(contentsOf:url));medicines=catalog.medicines;references=catalog.clinicalReferences;for m in medicines{index[m.id]=normalized(([m.name,m.ingredient,m.drugClass]+m.aliases).joined(separator:" "))}}catch{self.error="Não foi possível carregar a base local. Nenhuma informação foi estimada."}}
 func results(_ query:String,onlySaved:Bool)->[Medicine]{let words=normalized(query).split(separator:" ").map(String.init);return medicines.filter{m in (!onlySaved || favorites.contains(m.id)) && words.allSatisfy{index[m.id,default:""].contains($0)}}}
 func related(_ medicine:Medicine)->[ClinicalReference]{references.filter{r in (medicine.clinicalReferenceIds ?? []).contains(r.id)&&r.ingredients.contains{normalized($0)==normalized(medicine.ingredient)}}}
 func toggle(_ id:String){if favorites.contains(id){favorites.remove(id)}else{favorites.insert(id)};UserDefaults.standard.set(favorites.sorted(),forKey:"doser.favorites")}
}
@main @MainActor struct DoserTV:App {
 @StateObject private var library=Library()
 var body:some Scene {WindowGroup {TabView{CatalogView(onlySaved:false).tabItem{Label("Pesquisar",systemImage:"magnifyingglass")};CatalogView(onlySaved:true).tabItem{Label("Favoritos",systemImage:"star")}}.tint(Color(red:0.38,green:0.65,blue:0.48)).environmentObject(library)}}
}
struct CatalogView:View {
 @EnvironmentObject var library:Library
 let onlySaved:Bool
 @State private var query=""
 @State private var limit=60
 var body:some View{NavigationStack{List {
  if let error=library.error{Text(error)}else{
   let results=library.results(query,onlySaved:onlySaved)
   Section {Text("\(results.count) registros · consulta offline").foregroundStyle(.secondary)}
   ForEach(Array(results.prefix(limit))){m in NavigationLink{MedicineView(medicine:m)}label:{VStack(alignment:.leading,spacing:8){Text(m.name).font(.headline);Text(m.ingredient).font(.subheadline).foregroundStyle(.secondary)}}}
   if results.count>limit{Button("Mostrar mais resultados"){limit+=60}}
   if results.isEmpty{Text("Nenhum registro encontrado. A ausência de resultados não exclui uma condição clínica.")}
  }
 }.navigationTitle(onlySaved ? "Favoritos" : "Doser").searchable(text:$query,prompt:"Nome, princípio ativo ou classe").onChange(of:query){_,_ in limit=60}}}
}
struct MedicineView:View {
 @EnvironmentObject var library:Library
 let medicine:Medicine
 var body:some View{List{
  Section("Identificação"){Text(medicine.ingredient);Text(medicine.drugClass);Button(library.favorites.contains(medicine.id) ? "Remover dos favoritos" : "Salvar nos favoritos"){library.toggle(medicine.id)}}
  Section{Text("Consulta documental. Não realiza diagnóstico nem define tratamento.")}
  ForEach(library.related(medicine)){reference in NavigationLink{ReferenceView(reference:reference)}label:{VStack(alignment:.leading){Text(reference.subject);Text("Referência PCDT separada da bula do produto").font(.subheadline).foregroundStyle(.secondary)}}}
  if library.related(medicine).isEmpty{Text("Informações clínicas não importadas para este registro. Consulte a bula da apresentação exata.")}
 }.navigationTitle(medicine.name)}
}
struct ReferenceView:View {
 let reference:ClinicalReference
 let labels=["indications":"Indicações","contraindications":"Contraindicações","precautions":"Precauções","adverse":"Reações adversas","interactions":"Interações"]
 var body:some View{List{
  Section("Contexto"){Text(reference.scope)}
  ForEach(reference.issues ?? [],id:\.self){Text($0).foregroundStyle(.orange)}
  ForEach(labels.keys.sorted(),id:\.self){key in if let fact=reference.facts[key]{NavigationLink(labels[key] ?? key){DocumentText(title:labels[key] ?? key,text:fact.text,source:fact.source)}}}
  ForEach(reference.usage){regimen in NavigationLink{RegimenView(regimen:regimen)}label:{VStack(alignment:.leading){Text(regimen.presentation);Text(regimen.population).font(.subheadline)}}}
  NavigationLink("Documento e versão"){DocumentText(title:"Fonte",text:"Referência de protocolo, não é bula nem confirmação da apresentação do registro.",source:reference.source)}
 }.navigationTitle(reference.subject)}
}
struct DocumentText:View {
 let title:String;let text:String;let source:DocumentarySource
 var body:some View{ScrollView{VStack(alignment:.leading,spacing:28){Text(text);Divider();Text(source.title).font(.headline);Text(source.url).font(.footnote);Text("Verificação: \(source.checkedAt) · Versão: \(source.version)").font(.footnote);Text("Conferência documental declarada; não equivale a uma avaliação clínica individual.").font(.footnote)}.padding(50)}.focusable().navigationTitle(title)}
}
struct RegimenView:View {
 let regimen:Regimen
 var body:some View{ScrollView{VStack(alignment:.leading,spacing:26){Text(regimen.population).font(.headline);Text("Esquema documental para a apresentação selecionada; não é dose individual prescrita.");Text(regimen.doseBasis=="per-day" ? "Dose diária no protocolo" : "Esquema descrito no documento").font(.headline);Text(regimen.dose);if let interval=regimen.interval{Text(interval)};if let age=regimen.age{Text(age)};if let route=regimen.route{Text(route)};if let max=regimen.maxDaily{Text("Limite diário documentado: "+max)};if let conditions=regimen.conditions{Divider();Text(conditions)};Divider();Text(regimen.source.title);Text(regimen.source.url).font(.footnote)}.padding(50)}.focusable().navigationTitle(regimen.presentation)}
}
