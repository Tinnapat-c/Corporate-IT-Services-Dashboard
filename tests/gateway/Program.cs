using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;

var schema=JsonNode.Parse(await File.ReadAllTextAsync("backend/swagger.json"))!;
void Check(bool condition,string message){if(!condition)throw new Exception(message);}
var transport=new FakeTransport();var gateway=new DashboardGateway(schema,transport);
var invalid=await gateway.Call("live-ops",new JsonObject{["viewerAD"]="someone"},default);Check(invalid.Status==400,"Must reject browser identity override");
Check((await gateway.Call("ticket-list",new JsonObject{["pageSize"]=501},default)).Status==400,"Page size bounded");
Check((await gateway.Call("workload",new JsonObject(),default)).Status==403,"Role must be enforced on server");
Check((await gateway.Call("live-ops",new JsonObject{["scope"]="TEAM"},default)).Status==200,"Allowed page must load");
Check((await gateway.Call("refresh-status",new JsonObject(),default)).Status==403,"Admin route must be enforced");
Check(transport.AccessCalls==1,"Access lookup should reuse a short session cache");
var filters=await gateway.Call("filter-options",new JsonObject(),default);Check(!filters.Body.ToJsonString().Contains("99999"),"Companywide Jobs count must not be sent to client");
var live=await gateway.Call("live-ops",new JsonObject(),default);Check(!live.Body.ToJsonString().Contains("secret-comment"),"Full comment content must not be returned");
var unknown=new DashboardGateway(schema,new FakeTransport{Known=false});Check((await unknown.Call("live-ops",new JsonObject(),default)).Status==403,"Unknown users denied");
var unauth=new DashboardGateway(schema,new FakeTransport{Unauthorized=true});Check((await unauth.Call("live-ops",new JsonObject(),default)).Status==401,"Authentication failure must not fall back to template");
var failed=new DashboardGateway(schema,new FakeTransport{FailResult=true});Check((await failed.Call("live-ops",new JsonObject(),default)).Status==422,"SP failures must not look like empty success");
var v2=new DashboardGateway(schema,new FakeTransport{UserShape=true,V2=true});
Check((await v2.Call("live",new JsonObject{["scope"]="ALL"},default,true)).Status==200,"V2 must accept new user access shape");
Check((await v2.Call("person-focus",new JsonObject(),default,true)).Status==403,"V2 requires its own page permission");
Check((await v2.Call("live",new JsonObject{["viewerAD"]="override"},default,true)).Status==400,"V2 cannot override Windows identity");
Check((await v2.Call("job-list",new JsonObject{["pageSize"]=501},default,true)).Status==400,"V2 paging bounded");
Check((await v2.Call("unknown",new JsonObject(),default,true)).Status==404,"Unknown V2 route denied");
var dbFailure=await failed.Call("live-ops",new JsonObject(),default);
Check(dbFailure.Body["message"]?.ToString()=="Internal SQL detail","DB ResultText must reach the UI");
var httpFailure=new DashboardGateway(schema,new FakeTransport{ErrorStatus=503,ErrorBody="{\"ResultCode\":\"E\",\"ResultText\":\"Person DB unavailable\"}"});
var unavailable=await httpFailure.Call("live-ops",new JsonObject(),default);
Check(unavailable.Status==503&&unavailable.Body["message"]?.ToString()=="Person DB unavailable","Non-200 DB error must preserve status and message");
var htmlFailure=new DashboardGateway(schema,new FakeTransport{ErrorStatus=502,ErrorBody="<html>upstream failure</html>"});
var html=await htmlFailure.Call("live-ops",new JsonObject(),default);
Check(html.Status==502&&html.Body["message"]?.ToString()=="API ตอบข้อผิดพลาด 502","Non-JSON failure must use a readable fallback");
Console.WriteLine("PASS: server page authorization, Admin restriction, unknown user, 401, SP failure, access cache, identity override rejection, page size, comment removal, companywide filter-count removal");

sealed class FakeTransport:HttpMessageHandler {
 public bool Known=true,Unauthorized=false,FailResult=false,UserShape=false,V2=false;public int AccessCalls;public int ErrorStatus;public string ErrorBody="";
 protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken token){
  if(Unauthorized)return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized));
  var name=request.RequestUri!.AbsolutePath.Split('/')[^1];string json="";
  if(name=="my-access"){AccessCalls++;json="{\"ResultCode\":\"S\",\"ResultData\":{\"access\":[{\"IsKnown\":"+(Known?"true":"false")+"}],\"pages\":[{\"PageCode\":\"LIVE\"}]}}";}
  if(name=="my-access"&&UserShape)json=json.Replace("\"access\"","\"user\"");
  if(name=="my-access"&&V2)json=json.Replace("\"LIVE\"","\"V2_LIVE\"");
  if(name!="my-access"&&ErrorStatus>0)return Task.FromResult(new HttpResponseMessage((HttpStatusCode)ErrorStatus){Content=new StringContent(ErrorBody,Encoding.UTF8,"application/json")});
  if(name!="my-access"&&FailResult)json="{\"ResultCode\":\"E\",\"ResultText\":\"Internal SQL detail\"}";
  else if(name=="filter-options")json="{\"ResultCode\":\"S\",\"ResultData\":{\"serviceGroups\":[{\"ServiceGroup\":\"Application\",\"Jobs\":99999}]}}";
  else if(name!="my-access")json="{\"ResultCode\":\"S\",\"ResultData\":{\"kpis\":[{\"OpenTotal\":12}],\"history\":[{\"Action\":\"Submit\",\"Comment\":\"secret-comment\"}]}}";
  return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content=new StringContent(json,Encoding.UTF8,"application/json")});
 }
}
