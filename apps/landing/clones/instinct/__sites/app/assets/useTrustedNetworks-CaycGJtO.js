import{r as k,m,t as b}from"./app-DVKIbK40.js";const y=(function(){var e={defaultValue:null,kind:"LocalArgument",name:"generation"},n={defaultValue:null,kind:"LocalArgument",name:"id"},a=[{alias:null,args:[{kind:"Variable",name:"generation",variableName:"generation"},{kind:"Variable",name:"id",variableName:"id"}],kind:"ScalarField",name:"blockTrustedNetworkPerson",storageKey:null}];return{fragment:{argumentDefinitions:[e,n],kind:"Fragment",metadata:null,name:"useTrustedNetworkBlocksBlockMutation",selections:a,type:"Mutation",abstractKey:null},kind:"Request",operation:{argumentDefinitions:[n,e],kind:"Operation",name:"useTrustedNetworkBlocksBlockMutation",selections:a},params:{cacheID:"80dc16f5953cc19e7223977ea682ec72",id:null,metadata:{},name:"useTrustedNetworkBlocksBlockMutation",operationKind:"mutation",text:`mutation useTrustedNetworkBlocksBlockMutation(
  $id: ID!
  $generation: Int!
) {
  blockTrustedNetworkPerson(id: $id, generation: $generation)
}
`}}})();y.hash="04ade94c8080b65e994b8b7a2d9f4865";const N=(function(){var e={defaultValue:null,kind:"LocalArgument",name:"decisionGeneration"},n={defaultValue:null,kind:"LocalArgument",name:"id"},a=[{alias:null,args:[{kind:"Variable",name:"decisionGeneration",variableName:"decisionGeneration"},{kind:"Variable",name:"id",variableName:"id"}],kind:"ScalarField",name:"unblockTrustedNetworkPerson",storageKey:null}];return{fragment:{argumentDefinitions:[e,n],kind:"Fragment",metadata:null,name:"useTrustedNetworkBlocksUnblockMutation",selections:a,type:"Mutation",abstractKey:null},kind:"Request",operation:{argumentDefinitions:[n,e],kind:"Operation",name:"useTrustedNetworkBlocksUnblockMutation",selections:a},params:{cacheID:"597346785f09422988d9335c2b42ffed",id:null,metadata:{},name:"useTrustedNetworkBlocksUnblockMutation",operationKind:"mutation",text:`mutation useTrustedNetworkBlocksUnblockMutation(
  $id: ID!
  $decisionGeneration: String!
) {
  unblockTrustedNetworkPerson(id: $id, decisionGeneration: $decisionGeneration)
}
`}}})();N.hash="6e56b82d45aff36535e20deb14f3d33d";const v=y,F=N;function P(){const[e,n]=k.useMutation(v),[a,c]=k.useMutation(F);return{isBlocking:n,isUnblocking:c,blockPerson({id:i,generation:u,onCompleted:o,onError:l}){const t="Couldn’t block this person. Refresh and try again.";e({variables:{id:i,generation:u},onCompleted(r,d){const s=m(d,t);if(s){l(s);return}o()},onError(r){l(m(b(r),t)??{message:t,code:null})}})},unblockPerson({id:i,decisionGeneration:u,onCompleted:o,onError:l}){const t="Couldn’t unblock this person. Refresh and try again.";a({variables:{id:i,decisionGeneration:u},onCompleted(r,d){const s=m(d,t);if(s){l(s);return}o()},onError(r){l(m(b(r),t)??{message:t,code:null})}})}}}const f=(function(){var e=[{defaultValue:null,kind:"LocalArgument",name:"id"}],n=[{alias:null,args:null,concreteType:"AgentToAgentSettings",kind:"LinkedField",name:"agentToAgentSettings",plural:!1,selections:[{alias:null,args:null,kind:"ScalarField",name:"enabled",storageKey:null}],storageKey:null},{alias:null,args:[{kind:"Variable",name:"id",variableName:"id"}],concreteType:"TrustedNetworkRequest",kind:"LinkedField",name:"trustedNetworkRequest",plural:!1,selections:[{alias:null,args:null,kind:"ScalarField",name:"id",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"generation",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"canBlock",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"status",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"displayName",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"phoneNumbers",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"createdAt",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"expiresAt",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"returnSmsPhoneNumber",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"returnWhatsAppPhoneNumber",storageKey:null}],storageKey:null}];return{fragment:{argumentDefinitions:e,kind:"Fragment",metadata:null,name:"useTrustedNetworkRequestQuery",selections:n,type:"Query",abstractKey:null},kind:"Request",operation:{argumentDefinitions:e,kind:"Operation",name:"useTrustedNetworkRequestQuery",selections:n},params:{cacheID:"2f8e424f9f421fcd62a1100e6520f0d6",id:null,metadata:{},name:"useTrustedNetworkRequestQuery",operationKind:"query",text:`query useTrustedNetworkRequestQuery(
  $id: ID!
) {
  agentToAgentSettings {
    enabled
  }
  trustedNetworkRequest(id: $id) {
    id
    generation
    canBlock
    status
    displayName
    phoneNumbers
    createdAt
    expiresAt
    returnSmsPhoneNumber
    returnWhatsAppPhoneNumber
  }
}
`}}})();f.hash="0b58841bba437edd31f14a2e19f1954a";const T=(function(){var e={defaultValue:null,kind:"LocalArgument",name:"generation"},n={defaultValue:null,kind:"LocalArgument",name:"id"},a=[{alias:null,args:[{kind:"Variable",name:"generation",variableName:"generation"},{kind:"Variable",name:"id",variableName:"id"}],concreteType:"TrustedNetworkRequest",kind:"LinkedField",name:"acceptTrustedNetworkRequest",plural:!1,selections:[{alias:null,args:null,kind:"ScalarField",name:"id",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"generation",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"canBlock",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"status",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"displayName",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"phoneNumbers",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"createdAt",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"expiresAt",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"returnSmsPhoneNumber",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"returnWhatsAppPhoneNumber",storageKey:null}],storageKey:null}];return{fragment:{argumentDefinitions:[e,n],kind:"Fragment",metadata:null,name:"useTrustedNetworkRequestAcceptMutation",selections:a,type:"Mutation",abstractKey:null},kind:"Request",operation:{argumentDefinitions:[n,e],kind:"Operation",name:"useTrustedNetworkRequestAcceptMutation",selections:a},params:{cacheID:"8755789ef326805b60e6b54e4c62c594",id:null,metadata:{},name:"useTrustedNetworkRequestAcceptMutation",operationKind:"mutation",text:`mutation useTrustedNetworkRequestAcceptMutation(
  $id: ID!
  $generation: Int!
) {
  acceptTrustedNetworkRequest(id: $id, generation: $generation) {
    id
    generation
    canBlock
    status
    displayName
    phoneNumbers
    createdAt
    expiresAt
    returnSmsPhoneNumber
    returnWhatsAppPhoneNumber
  }
}
`}}})();T.hash="72d104a915fe60bcb9d609cdab18aa12";const w=(function(){var e={defaultValue:null,kind:"LocalArgument",name:"generation"},n={defaultValue:null,kind:"LocalArgument",name:"id"},a=[{alias:null,args:[{kind:"Variable",name:"generation",variableName:"generation"},{kind:"Variable",name:"id",variableName:"id"}],concreteType:"TrustedNetworkRequest",kind:"LinkedField",name:"declineTrustedNetworkRequest",plural:!1,selections:[{alias:null,args:null,kind:"ScalarField",name:"id",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"generation",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"canBlock",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"status",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"displayName",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"phoneNumbers",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"createdAt",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"expiresAt",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"returnSmsPhoneNumber",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"returnWhatsAppPhoneNumber",storageKey:null}],storageKey:null}];return{fragment:{argumentDefinitions:[e,n],kind:"Fragment",metadata:null,name:"useTrustedNetworkRequestDeclineMutation",selections:a,type:"Mutation",abstractKey:null},kind:"Request",operation:{argumentDefinitions:[n,e],kind:"Operation",name:"useTrustedNetworkRequestDeclineMutation",selections:a},params:{cacheID:"de2ff0598a776a1d36afc6cc7bb9a56b",id:null,metadata:{},name:"useTrustedNetworkRequestDeclineMutation",operationKind:"mutation",text:`mutation useTrustedNetworkRequestDeclineMutation(
  $id: ID!
  $generation: Int!
) {
  declineTrustedNetworkRequest(id: $id, generation: $generation) {
    id
    generation
    canBlock
    status
    displayName
    phoneNumbers
    createdAt
    expiresAt
    returnSmsPhoneNumber
    returnWhatsAppPhoneNumber
  }
}
`}}})();w.hash="ae5be7338e51635f40a2f10780b3f034";const A=f,R=T,q=w;function C(e,n){return k.useLazyLoadQuery(A,{id:e},{fetchPolicy:"network-only",fetchKey:n})}function V(){const[e,n]=k.useMutation(R),[a,c]=k.useMutation(q);return{isDeciding:n||c,decide:({id:i,generation:u,decision:o,onCompleted:l,onError:t})=>{const r="We couldn’t confirm your choice. Refresh to check the request before trying again.",d=s=>t(m(b(s),r)??{message:r,code:null});o==="accept"?e({variables:{id:i,generation:u},onCompleted(s,p){const g=m(p,r);if(g){t(g);return}l(s.acceptTrustedNetworkRequest)},onError:d}):a({variables:{id:i,generation:u},onCompleted(s,p){const g=m(p,r);if(g){t(g);return}l(s.declineTrustedNetworkRequest)},onError:d})}}}const K=(function(){var e={defaultValue:null,kind:"LocalArgument",name:"blockedCursor"},n={defaultValue:null,kind:"LocalArgument",name:"contactsCursor"},a={defaultValue:null,kind:"LocalArgument",name:"requestsCursor"},c={kind:"Literal",name:"limit",value:20},i={alias:null,args:null,kind:"ScalarField",name:"id",storageKey:null},u={alias:null,args:null,kind:"ScalarField",name:"displayName",storageKey:null},o={alias:null,args:null,kind:"ScalarField",name:"phoneNumbers",storageKey:null},l={alias:null,args:null,kind:"ScalarField",name:"createdAt",storageKey:null},t={alias:null,args:null,kind:"ScalarField",name:"cursor",storageKey:null},r={alias:null,args:null,kind:"ScalarField",name:"generation",storageKey:null},d={alias:null,args:null,kind:"ScalarField",name:"expiresAt",storageKey:null},s=[{alias:null,args:null,concreteType:"AgentToAgentSettings",kind:"LinkedField",name:"agentToAgentSettings",plural:!1,selections:[{alias:null,args:null,kind:"ScalarField",name:"enabled",storageKey:null}],storageKey:null},{alias:null,args:[{kind:"Variable",name:"cursor",variableName:"blockedCursor"},c],concreteType:"TrustedNetworkBlockedPersonPage",kind:"LinkedField",name:"trustedNetworkBlockedPeople",plural:!1,selections:[{alias:null,args:null,concreteType:"TrustedNetworkBlockedPerson",kind:"LinkedField",name:"items",plural:!0,selections:[i,{alias:null,args:null,kind:"ScalarField",name:"decisionGeneration",storageKey:null},u,o,l],storageKey:null},t],storageKey:null},{alias:null,args:[{kind:"Variable",name:"cursor",variableName:"contactsCursor"},c],concreteType:"TrustedNetworkContactPage",kind:"LinkedField",name:"trustedNetworkContacts",plural:!1,selections:[{alias:null,args:null,concreteType:"TrustedNetworkContact",kind:"LinkedField",name:"items",plural:!0,selections:[i,r,u,o,l],storageKey:null},t],storageKey:null},{alias:null,args:[c],concreteType:"TrustedNetworkSentRequest",kind:"LinkedField",name:"trustedNetworkSentRequests",plural:!0,selections:[i,{alias:null,args:null,kind:"ScalarField",name:"phoneNumber",storageKey:null},l,d],storageKey:"trustedNetworkSentRequests(limit:20)"},{alias:null,args:[{kind:"Variable",name:"cursor",variableName:"requestsCursor"},c],concreteType:"TrustedNetworkRequestPage",kind:"LinkedField",name:"trustedNetworkRequests",plural:!1,selections:[{alias:null,args:null,concreteType:"TrustedNetworkRequest",kind:"LinkedField",name:"items",plural:!0,selections:[i,r,{alias:null,args:null,kind:"ScalarField",name:"status",storageKey:null},u,o,l,d,{alias:null,args:null,kind:"ScalarField",name:"returnSmsPhoneNumber",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"returnWhatsAppPhoneNumber",storageKey:null}],storageKey:null},t],storageKey:null}];return{fragment:{argumentDefinitions:[e,n,a],kind:"Fragment",metadata:null,name:"useTrustedNetworksQuery",selections:s,type:"Query",abstractKey:null},kind:"Request",operation:{argumentDefinitions:[n,a,e],kind:"Operation",name:"useTrustedNetworksQuery",selections:s},params:{cacheID:"0c6a846f2cb9f754399694158bf05196",id:null,metadata:{},name:"useTrustedNetworksQuery",operationKind:"query",text:`query useTrustedNetworksQuery(
  $contactsCursor: String
  $requestsCursor: String
  $blockedCursor: String
) {
  agentToAgentSettings {
    enabled
  }
  trustedNetworkBlockedPeople(limit: 20, cursor: $blockedCursor) {
    items {
      id
      decisionGeneration
      displayName
      phoneNumbers
      createdAt
    }
    cursor
  }
  trustedNetworkContacts(limit: 20, cursor: $contactsCursor) {
    items {
      id
      generation
      displayName
      phoneNumbers
      createdAt
    }
    cursor
  }
  trustedNetworkSentRequests(limit: 20) {
    id
    phoneNumber
    createdAt
    expiresAt
  }
  trustedNetworkRequests(limit: 20, cursor: $requestsCursor) {
    items {
      id
      generation
      status
      displayName
      phoneNumbers
      createdAt
      expiresAt
      returnSmsPhoneNumber
      returnWhatsAppPhoneNumber
    }
    cursor
  }
}
`}}})();K.hash="78fb7fdf1a730f849639563188c8f267";const S=(function(){var e=[{defaultValue:null,kind:"LocalArgument",name:"enabled"}],n=[{alias:null,args:[{kind:"Variable",name:"enabled",variableName:"enabled"}],concreteType:"AgentToAgentSettings",kind:"LinkedField",name:"setAgentToAgentEnabled",plural:!1,selections:[{alias:null,args:null,kind:"ScalarField",name:"enabled",storageKey:null}],storageKey:null}];return{fragment:{argumentDefinitions:e,kind:"Fragment",metadata:null,name:"useTrustedNetworksSettingsMutation",selections:n,type:"Mutation",abstractKey:null},kind:"Request",operation:{argumentDefinitions:e,kind:"Operation",name:"useTrustedNetworksSettingsMutation",selections:n},params:{cacheID:"12df9dcccd675e2fdc8064c4d7b5a6a9",id:null,metadata:{},name:"useTrustedNetworksSettingsMutation",operationKind:"mutation",text:`mutation useTrustedNetworksSettingsMutation(
  $enabled: Boolean!
) {
  setAgentToAgentEnabled(enabled: $enabled) {
    enabled
  }
}
`}}})();S.hash="c0dbc6d5b3c7bae8738aec1bdf232ae7";const h=(function(){var e={defaultValue:null,kind:"LocalArgument",name:"generation"},n={defaultValue:null,kind:"LocalArgument",name:"id"},a=[{alias:null,args:[{kind:"Variable",name:"generation",variableName:"generation"},{kind:"Variable",name:"id",variableName:"id"}],kind:"ScalarField",name:"removeTrustedNetworkContact",storageKey:null}];return{fragment:{argumentDefinitions:[e,n],kind:"Fragment",metadata:null,name:"useTrustedNetworksRemoveMutation",selections:a,type:"Mutation",abstractKey:null},kind:"Request",operation:{argumentDefinitions:[n,e],kind:"Operation",name:"useTrustedNetworksRemoveMutation",selections:a},params:{cacheID:"298f9f6d833c8751e3cf4fdbe1fc350b",id:null,metadata:{},name:"useTrustedNetworksRemoveMutation",operationKind:"mutation",text:`mutation useTrustedNetworksRemoveMutation(
  $id: ID!
  $generation: Int!
) {
  removeTrustedNetworkContact(id: $id, generation: $generation)
}
`}}})();h.hash="13312b260ad04f654aaf87e7cc27a5cc";const M=K,D=S,$=h;function B({contactsCursor:e,requestsCursor:n,blockedCursor:a,fetchKey:c}){return k.useLazyLoadQuery(M,{contactsCursor:e,requestsCursor:n,blockedCursor:a},{fetchPolicy:"network-only",fetchKey:c})}function x(){const[e,n]=k.useMutation(D),[a,c]=k.useMutation($);return{isUpdating:n,isRemoving:c,setEnabled({enabled:i,onCompleted:u,onError:o}){const l="Couldn’t update your connection setting. Please try again.";e({variables:{enabled:i},onCompleted(t,r){const d=m(r,l);if(d){o(d);return}u()},onError(t){o(m(b(t),l)??{message:l,code:null})}})},removeContact({id:i,generation:u,onCompleted:o,onError:l}){const t="Couldn’t remove this person. Refresh and try again.";a({variables:{id:i,generation:u},onCompleted(r,d){const s=m(d,t);if(s){l(s);return}o()},onError(r){l(m(b(r),t)??{message:t,code:null})}})}}}export{V as a,x as b,P as c,B as d,C as u};
