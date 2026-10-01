import{r as l,t as m,m as d}from"./app-DVKIbK40.js";const c=(function(){var e=[{defaultValue:null,kind:"LocalArgument",name:"token"}],n=[{alias:null,args:[{kind:"Variable",name:"token",variableName:"token"}],concreteType:"TrustedNetworkJoinLinkInfo",kind:"LinkedField",name:"resolveTrustedNetworkJoinLink",plural:!1,selections:[{alias:null,args:null,kind:"ScalarField",name:"state",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"ownerName",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"ownerPhoneNumber",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"ownerEmail",storageKey:null}],storageKey:null}];return{fragment:{argumentDefinitions:e,kind:"Fragment",metadata:null,name:"useTrustedNetworkJoinLinkQuery",selections:n,type:"Query",abstractKey:null},kind:"Request",operation:{argumentDefinitions:e,kind:"Operation",name:"useTrustedNetworkJoinLinkQuery",selections:n},params:{cacheID:"58952ceddb5c080edb24c118dd89c08b",id:null,metadata:{},name:"useTrustedNetworkJoinLinkQuery",operationKind:"query",text:`query useTrustedNetworkJoinLinkQuery(
  $token: String!
) {
  resolveTrustedNetworkJoinLink(token: $token) {
    state
    ownerName
    ownerPhoneNumber
    ownerEmail
  }
}
`}}})();c.hash="1c3bf86169d976e116c443d27f89c449";const w=(function(){var e=[{alias:null,args:null,concreteType:"TrustedNetworkJoinLink",kind:"LinkedField",name:"myTrustedNetworkJoinLink",plural:!1,selections:[{alias:null,args:null,kind:"ScalarField",name:"url",storageKey:null}],storageKey:null}];return{fragment:{argumentDefinitions:[],kind:"Fragment",metadata:null,name:"useTrustedNetworkJoinLinkMineQuery",selections:e,type:"Query",abstractKey:null},kind:"Request",operation:{argumentDefinitions:[],kind:"Operation",name:"useTrustedNetworkJoinLinkMineQuery",selections:e},params:{cacheID:"1e5adf4c5dede9a409a11c551e469b14",id:null,metadata:{},name:"useTrustedNetworkJoinLinkMineQuery",operationKind:"query",text:`query useTrustedNetworkJoinLinkMineQuery {
  myTrustedNetworkJoinLink {
    url
  }
}
`}}})();w.hash="f000a75a05168db87610a36464a9ef2d";const y=(function(){var e=[{alias:null,args:null,concreteType:"TrustedNetworkJoinLink",kind:"LinkedField",name:"resetTrustedNetworkJoinLink",plural:!1,selections:[{alias:null,args:null,kind:"ScalarField",name:"url",storageKey:null}],storageKey:null}];return{fragment:{argumentDefinitions:[],kind:"Fragment",metadata:null,name:"useTrustedNetworkJoinLinkResetMutation",selections:e,type:"Mutation",abstractKey:null},kind:"Request",operation:{argumentDefinitions:[],kind:"Operation",name:"useTrustedNetworkJoinLinkResetMutation",selections:e},params:{cacheID:"eb6791e7b3b8667037995410bffe9836",id:null,metadata:{},name:"useTrustedNetworkJoinLinkResetMutation",operationKind:"mutation",text:`mutation useTrustedNetworkJoinLinkResetMutation {
  resetTrustedNetworkJoinLink {
    url
  }
}
`}}})();y.hash="137dd5f0c2759058663bf13009b3576a";const N=(function(){var e=[{defaultValue:null,kind:"LocalArgument",name:"token"}],n=[{alias:null,args:[{kind:"Variable",name:"token",variableName:"token"}],concreteType:"TrustedNetworkJoinRequestResult",kind:"LinkedField",name:"requestTrustedNetworkJoin",plural:!1,selections:[{alias:null,args:null,kind:"ScalarField",name:"outcome",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"requestedByMe",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"ownerName",storageKey:null}],storageKey:null}];return{fragment:{argumentDefinitions:e,kind:"Fragment",metadata:null,name:"useTrustedNetworkJoinLinkRequestMutation",selections:n,type:"Mutation",abstractKey:null},kind:"Request",operation:{argumentDefinitions:e,kind:"Operation",name:"useTrustedNetworkJoinLinkRequestMutation",selections:n},params:{cacheID:"198da365ca3f4d077857a7e640e132ea",id:null,metadata:{},name:"useTrustedNetworkJoinLinkRequestMutation",operationKind:"mutation",text:`mutation useTrustedNetworkJoinLinkRequestMutation(
  $token: String!
) {
  requestTrustedNetworkJoin(token: $token) {
    outcome
    requestedByMe
    ownerName
  }
}
`}}})();N.hash="d34630a64dcece7da681b232b30efda7";const f=c,L=w,T=y,J=N;function b(e){const t=l.useLazyLoadQuery(f,{token:e},{fetchPolicy:"network-only"}).resolveTrustedNetworkJoinLink;return{state:t.state==="%future added value"?"INVALID":t.state,ownerName:t.ownerName,ownerPhoneNumber:t.ownerPhoneNumber,ownerEmail:t.ownerEmail}}function q(e){return l.useLazyLoadQuery(L,{},{fetchPolicy:"network-only",fetchKey:e}).myTrustedNetworkJoinLink}function M(){const[e,n]=l.useMutation(T);return{isResetting:n,reset({onCompleted:t,onError:i}){const r="Couldn’t make a new link right now. Please try again.";e({variables:{},onCompleted(a,o){const u=d(o,r);if(u){i(u);return}t(a.resetTrustedNetworkJoinLink)},onError(a){i(g(m(a),r))}})}}}function g(e,n){return d(e,n)??{message:n,code:null}}function h(){const[e,n]=l.useMutation(J);return{isRequesting:n,request({token:t,onCompleted:i,onError:r}){const a="Couldn’t send your request right now. Please try again.";e({variables:{token:t},onCompleted(o,u){const k=d(u,a);if(k){r(k);return}const s=o.requestTrustedNetworkJoin;i({outcome:s.outcome==="%future added value"?"SENT":s.outcome,requestedByMe:s.requestedByMe,ownerName:s.ownerName})},onError(o){r(g(m(o),a))}})}}}export{h as a,q as b,M as c,b as u};
