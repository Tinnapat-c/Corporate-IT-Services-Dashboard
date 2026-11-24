using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;

var root=AppContext.BaseDirectory;
var builder=WebApplication.CreateBuilder(new WebApplicationOptions { ContentRootPath=root, WebRootPath=Path.Combine(root,"web") });
builder.WebHost.UseSetting("urls","http://127.0.0.1:8766");
var app=builder.Build();
var schema=JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(root,"swagger.json")))!;
var gateway=new DashboardGateway(schema);
app.Use(async (context,next)=>{
 context.Response.Headers["Cache-Control"]="no-store";
 context.Response.Headers["X-Content-Type-Options"]="nosniff";
 context.Response.Headers["Referrer-Policy"]="same-origin";
 context.Response.Headers["Content-Security-Policy"]="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'";
 if(context.Request.Host.Host!="127.0.0.1" || context.Request.Host.Port!=8766){context.Response.StatusCode=403;return;}
 if((context.Request.Path.StartsWithSegments("/api")||context.Request.Path.StartsWithSegments("/api2"))){
  var origin=context.Request.Headers.Origin.ToString();
  if(origin.Length>0 && origin!="http://127.0.0.1:8766"){context.Response.StatusCode=403;return;}
 }
 await next(context);
});
app.MapGet("/health",()=>Results.Json(new {status="ready",source="api",authentication="Windows account running this application"}));
app.MapPost("/{version:regex(^api2?$)}/dashboard/{endpoint}",async (HttpContext context,string version,string endpoint)=>{
 try{
  if(!context.Request.HasJsonContentType())return Results.Json(new {message="ต้องส่ง application/json"},statusCode:415);
  if(context.Request.ContentLength>65536)return Results.StatusCode(413);
  var body=await JsonNode.ParseAsync(context.Request.Body,cancellationToken:context.RequestAborted) as JsonObject ?? new JsonObject();
  var result=await gateway.Call(endpoint,body,context.RequestAborted,version=="api2");
  return Results.Json(result.Body,statusCode:result.Status);
 }catch(OperationCanceledException){return Results.Json(new {message="API ใช้เวลาตอบกลับนาน กรุณาลองอีกครั้ง"},statusCode:504);}
 catch(Exception){return Results.Json(new {message="เชื่อม API ไม่สำเร็จ กรุณาเปิด Open-API-Dashboard.cmd ด้วยบัญชี Windows ที่เปิด Swagger ได้ หากยังไม่ได้ให้ทีมระบบตรวจ Windows Authentication"},statusCode:502);}
});
app.UseDefaultFiles();app.UseStaticFiles();
if(string.Equals(Path.GetFileName(Environment.ProcessPath),"ApiDashboard.exe",StringComparison.OrdinalIgnoreCase)){
 app.Lifetime.ApplicationStarted.Register(()=>{try{System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("http://127.0.0.1:8766/"){UseShellExecute=true});}catch{}});
}
Console.WriteLine("Dashboard API: http://127.0.0.1:8766/");
await app.RunAsync();

public sealed class DashboardGateway {
 readonly JsonNode schema;
 readonly HttpClient http;
 readonly SemaphoreSlim accessLock=new(1,1);
 JsonNode? access;
 DateTime accessAt;
 const string Upstream="https://bcg4-dev.benchachinda.co.th/dsm-api/api/dashboard/";
 static readonly Dictionary<string,string[]> permissions=new(){
  ["live-ops"]=["LIVE"],["severity-summary"]=["SLA_SEVERITY"],["aging"]=["AGING"],
  ["workload"]=["WORKLOAD","ASSIGNEE_WORK"],["job-detail"]=["JOB_DETAIL","ACTIVITY"],
  ["resolution-time"]=["RESOLUTION"],["process-quality"]=["PROCESS_QUALITY"],
  ["sla-drilldown"]=["SLA_DRILLDOWN"],["monthly-trend"]=["TREND_METRIC","TREND_FUNCTION"],
  ["backlog-forecast"]=["ANALYTICAL"],["refresh-status"]=["ADMIN"]
 };
 public DashboardGateway(JsonNode schema,HttpMessageHandler? handler=null){
  this.schema=schema;
  http=new HttpClient(handler??new HttpClientHandler {UseDefaultCredentials=true,AllowAutoRedirect=false}){Timeout=TimeSpan.FromSeconds(40)};
 }
 public async Task<(int Status,JsonNode Body)> Call(string endpoint,JsonObject body,CancellationToken ct,bool v2=false){
  var path=schema["paths"]?[(v2?"/api2/dashboard/":"/api/dashboard/")+endpoint]?["post"];
  if(path==null)return Error(404,"ไม่มี API นี้");
  var reference=path["requestBody"]?["content"]?["application/json"]?["schema"]?["$ref"]?.GetValue<string>();
  var props=reference==null?new JsonObject():schema["components"]?["schemas"]?[reference.Split('/').Last()]?["properties"] as JsonObject ?? new JsonObject();
  foreach(var pair in body){
   if(!props.ContainsKey(pair.Key))return Error(400,"พารามิเตอร์ไม่รองรับ: "+pair.Key);
   if(pair.Value==null)continue;
   var type=props[pair.Key]?["type"]?.GetValue<string>();
   if(pair.Value is not JsonValue val)return Error(400,"รูปแบบพารามิเตอร์ไม่ถูกต้อง");
   if(type=="string"&&!val.TryGetValue<string>(out _))return Error(400,"ต้องเป็นข้อความ: "+pair.Key);
   if(type=="integer"&&!val.TryGetValue<int>(out _))return Error(400,"ต้องเป็นจำนวนเต็ม: "+pair.Key);
   if(type=="boolean"&&!val.TryGetValue<bool>(out _))return Error(400,"ต้องเป็น true/false: "+pair.Key);
   if(type=="string"&&val.GetValue<string>().Length>300)return Error(400,"ข้อความยาวเกินไป");
   if(props[pair.Key]?["format"]?.ToString()=="date"&&!DateOnly.TryParseExact(val.GetValue<string>(),"yyyy-MM-dd",out _))return Error(400,"วันที่ต้องเป็น yyyy-MM-dd");
  }
  if(body["scope"]!=null && body["scope"]!.ToString() is not ("TEAM" or "ALL"))return Error(400,"scope ต้องเป็น TEAM หรือ ALL");
  if(body["page"]!=null&&body["page"]!.GetValue<int>()<1)return Error(400,"page ต้องเริ่มจาก 1");
  if(body["pageSize"]!=null&&body["pageSize"]!.GetValue<int>() is <1 or >500)return Error(400,"pageSize ต้องอยู่ระหว่าง 1–500");
  var me=await GetAccess(ct);
  if(me.Status!=200)return me;
  var info=((me.Body["ResultData"]?["user"]??me.Body["ResultData"]?["access"]) as JsonArray)?.FirstOrDefault();
  if(info?["IsKnown"]?.GetValue<bool>()!=true)return Error(403,"ไม่มีสิทธิ์เข้าใช้งาน");
  var pages=(me.Body["ResultData"]?["pages"] as JsonArray)?.Select(p=>p?["PageCode"]?.ToString()??"").ToHashSet()??new HashSet<string>();
  if(!v2&&endpoint=="my-access")return me;
  if(v2){
   var required=endpoint switch {"live"=>new[]{"V2_LIVE","V2_INCIDENT"},"sla-breached"=>new[]{"V2_SLA_BREACHED"},"completed"=>new[]{"V2_COMPLETED"},"teams"=>new[]{"V2_TEAMS"},"team-focus"=>new[]{"V2_TEAM_FOCUS"},"person-focus"=>new[]{"V2_PERSON_FOCUS"},"workload"=>new[]{"V2_WORKLOAD"},"job-list"=>new[]{"V2_JOB_LIST"},"job-detail"=>new[]{"V2_JOB_DETAIL"},"filters"=>pages.Where(p=>p.StartsWith("V2_",StringComparison.Ordinal)).ToArray(),_=>Array.Empty<string>()};
   if(!required.Any(pages.Contains))return Error(403,"ไม่มีสิทธิ์เปิดหน้านี้");
   return await Send(endpoint,body,ct,true);
  }
  if(!permissions.ContainsKey(endpoint)&&endpoint is not ("filter-options" or "my-team" or "ticket-list"))return Error(404,"ไม่มี API นี้");
  if(permissions.TryGetValue(endpoint,out var allowed)&&!allowed.Any(pages.Contains))return Error(403,"ไม่มีสิทธิ์เปิดหน้านี้");
  if(endpoint=="ticket-list"&&pages.Count==0)return Error(403,"ไม่มีสิทธิ์ดูรายการงาน");
  var result=await Send(endpoint,body,ct);
  if(endpoint=="filter-options"&&result.Status==200)RemoveCompanyCounts(result.Body);
  return result;
 }
 async Task<(int Status,JsonNode Body)> GetAccess(CancellationToken ct){
  await accessLock.WaitAsync(ct);
  try{
   if(access!=null&&DateTime.UtcNow-accessAt<TimeSpan.FromSeconds(30))return(200,access.DeepClone());
   var result=await Send("my-access",new JsonObject(),ct);
   if(result.Status==200&&result.Body["ResultCode"]?.ToString()=="S"){access=result.Body.DeepClone();accessAt=DateTime.UtcNow;}
   return result;
  }finally{accessLock.Release();}
 }
 async Task<(int Status,JsonNode Body)> Send(string endpoint,JsonObject body,CancellationToken ct,bool v2=false){
  using var req=new HttpRequestMessage(HttpMethod.Post,(v2?"https://bcg4-dev.benchachinda.co.th/dsm-api/api2/dashboard/":Upstream)+endpoint);
  if(v2||endpoint is not ("my-access" or "filter-options"))req.Content=new StringContent(body.ToJsonString(),Encoding.UTF8,"application/json");
  using var response=await http.SendAsync(req,ct);
  if(response.StatusCode==HttpStatusCode.Unauthorized)return Error(401,"API ต้องยืนยันบัญชี Windows กรุณาเปิดตัวเชื่อมด้วยบัญชีที่เข้า Swagger ได้");
  var content=await response.Content.ReadAsStringAsync(ct);
  JsonNode? node=null;
  try{node=JsonNode.Parse(content);}catch(System.Text.Json.JsonException){}
  if(!response.IsSuccessStatusCode)return Error((int)response.StatusCode,ResponseError(node)??"API ตอบข้อผิดพลาด "+(int)response.StatusCode);
  if(node==null)return Error(502,"API ไม่ได้ส่ง JSON ที่ใช้งานได้");
  if(node["ResultCode"]?.ToString()!="S")return Error(422,ResponseError(node)??"API ไม่สามารถส่งข้อมูลตามคำขอได้ กรุณาตรวจตัวกรองหรือสิทธิ์");
  ScrubComments(node);
  return(200,node);
 }
 static string? ResponseError(JsonNode? node){
  if(node is not JsonObject obj)return null;
  foreach(var key in new[]{"ResultText","message","Message","detail","Detail"}){
   if(obj[key] is JsonValue value&&value.TryGetValue<string>(out var text)&&!string.IsNullOrWhiteSpace(text))return text;
  }
  return null;
 }
 static void ScrubComments(JsonNode? node){
  if(node is JsonObject obj){foreach(var key in obj.Select(p=>p.Key).Where(k=>new[]{"comment","comments","commenttext","worknote","worknotes"}.Contains(k.ToLowerInvariant())).ToArray())obj.Remove(key);foreach(var pair in obj.ToArray())ScrubComments(pair.Value);}
  else if(node is JsonArray arr)foreach(var n in arr)ScrubComments(n);
 }
 static void RemoveCompanyCounts(JsonNode? node){
  if(node is JsonObject obj){obj.Remove("Jobs");foreach(var pair in obj.ToArray())RemoveCompanyCounts(pair.Value);}
  else if(node is JsonArray arr)foreach(var n in arr)RemoveCompanyCounts(n);
 }
 static (int,JsonNode) Error(int status,string message)=>(status,new JsonObject{["message"]=message});
}
