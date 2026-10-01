import{b as c,r as y,aX as k,R as p}from"./app-DVKIbK40.js";const S=(function(){var a={alias:null,args:null,kind:"ScalarField",name:"kind",storageKey:null},e=[{alias:null,args:null,concreteType:"VaultEntryMeta",kind:"LinkedField",name:"vaultEntries",plural:!0,selections:[a,{alias:null,args:null,kind:"ScalarField",name:"name",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"isAgentEntry",storageKey:null},{alias:null,args:null,concreteType:"VaultFieldStatus",kind:"LinkedField",name:"fields",plural:!0,selections:[{alias:null,args:null,kind:"ScalarField",name:"key",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"populated",storageKey:null}],storageKey:null}],storageKey:null},{alias:null,args:null,concreteType:"VaultKindSchema",kind:"LinkedField",name:"vaultKinds",plural:!0,selections:[a,{alias:null,args:null,kind:"ScalarField",name:"subfieldKeys",storageKey:null}],storageKey:null}];return{fragment:{argumentDefinitions:[],kind:"Fragment",metadata:null,name:"useVaultQuery",selections:e,type:"Query",abstractKey:null},kind:"Request",operation:{argumentDefinitions:[],kind:"Operation",name:"useVaultQuery",selections:e},params:{cacheID:"31f0a6b24c799f783f90e403051cb1de",id:null,metadata:{},name:"useVaultQuery",operationKind:"query",text:`query useVaultQuery {
  vaultEntries {
    kind
    name
    isAgentEntry
    fields {
      key
      populated
    }
  }
  vaultKinds {
    kind
    subfieldKeys
  }
}
`}}})();S.hash="f2044a453e98ee5fc837286e36234a74";const K=(function(){var a=[{defaultValue:null,kind:"LocalArgument",name:"input"}],e=[{alias:null,args:[{kind:"Variable",name:"input",variableName:"input"}],concreteType:"VaultEntryMeta",kind:"LinkedField",name:"upsertVaultEntry",plural:!1,selections:[{alias:null,args:null,kind:"ScalarField",name:"kind",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"name",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"isAgentEntry",storageKey:null},{alias:null,args:null,concreteType:"VaultFieldStatus",kind:"LinkedField",name:"fields",plural:!0,selections:[{alias:null,args:null,kind:"ScalarField",name:"key",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"populated",storageKey:null}],storageKey:null}],storageKey:null}];return{fragment:{argumentDefinitions:a,kind:"Fragment",metadata:null,name:"useVaultUpsertMutation",selections:e,type:"Mutation",abstractKey:null},kind:"Request",operation:{argumentDefinitions:a,kind:"Operation",name:"useVaultUpsertMutation",selections:e},params:{cacheID:"18ee1cd7f608c3b8198a8cc8b041a4ba",id:null,metadata:{},name:"useVaultUpsertMutation",operationKind:"mutation",text:`mutation useVaultUpsertMutation(
  $input: VaultUpsertInput!
) {
  upsertVaultEntry(input: $input) {
    kind
    name
    isAgentEntry
    fields {
      key
      populated
    }
  }
}
`}}})();K.hash="c836455f1a85755f5c6aff2e2ac0eeeb";const F=(function(){var a=[{defaultValue:null,kind:"LocalArgument",name:"kind"},{defaultValue:null,kind:"LocalArgument",name:"name"}],e=[{alias:null,args:[{kind:"Variable",name:"kind",variableName:"kind"},{kind:"Variable",name:"name",variableName:"name"}],kind:"ScalarField",name:"deleteVaultEntry",storageKey:null}];return{fragment:{argumentDefinitions:a,kind:"Fragment",metadata:null,name:"useVaultDeleteMutation",selections:e,type:"Mutation",abstractKey:null},kind:"Request",operation:{argumentDefinitions:a,kind:"Operation",name:"useVaultDeleteMutation",selections:e},params:{cacheID:"5ac21a5f5a4e3b35c95c9e09b3a99010",id:null,metadata:{},name:"useVaultDeleteMutation",operationKind:"mutation",text:`mutation useVaultDeleteMutation(
  $kind: String!
  $name: String!
) {
  deleteVaultEntry(kind: $kind, name: $name)
}
`}}})();F.hash="0da49963303b36e82c71b45a1edfcb2d";const E=(function(){var a={defaultValue:null,kind:"LocalArgument",name:"key"},e={defaultValue:null,kind:"LocalArgument",name:"kind"},n={defaultValue:null,kind:"LocalArgument",name:"name"},m=[{alias:null,args:[{kind:"Variable",name:"key",variableName:"key"},{kind:"Variable",name:"kind",variableName:"kind"},{kind:"Variable",name:"name",variableName:"name"}],kind:"ScalarField",name:"revealVaultSubfieldValue",storageKey:null}];return{fragment:{argumentDefinitions:[a,e,n],kind:"Fragment",metadata:null,name:"useVaultRevealMutation",selections:m,type:"Mutation",abstractKey:null},kind:"Request",operation:{argumentDefinitions:[e,n,a],kind:"Operation",name:"useVaultRevealMutation",selections:m},params:{cacheID:"1bf98a64221b8422885c68b17f3b6778",id:null,metadata:{},name:"useVaultRevealMutation",operationKind:"mutation",text:`mutation useVaultRevealMutation(
  $kind: String!
  $name: String!
  $key: String!
) {
  revealVaultSubfieldValue(kind: $kind, name: $name, key: $key)
}
`}}})();E.hash="b4407a5b382d2198d47f81fdba45ba53";const M="totp",U=S,x=K,N=F,w=E;function Q(){const[a,e]=c.useState(0),[n,m]=y.useMutation(x),[f,h]=y.useMutation(N),[b]=y.useMutation(w),v=y.useLazyLoadQuery(U,{},{fetchKey:a,fetchPolicy:"store-and-network"}),L=v.vaultEntries,D=v.vaultKinds,A=c.useCallback(()=>e(u=>u+1),[]),$=c.useCallback(({kind:u,name:o,previousName:d,isAgentEntry:r,fields:l,onCompleted:t,onError:s})=>{n({variables:{input:{kind:u,name:o,previousName:d,isAgentEntry:r,fields:l}},onCompleted:(i,g)=>{const V=p(g,"Failed to save vault entry");if(e(I=>I+1),V){s(V);return}t(i.upsertVaultEntry)},onError:i=>{e(g=>g+1),s(k(i,"Failed to save vault entry"))}})},[n]),C=c.useCallback(({kind:u,name:o,onCompleted:d,onError:r})=>{f({variables:{kind:u,name:o},onCompleted:(l,t)=>{const s=p(t,"Failed to delete vault entry");if(e(i=>i+1),s){r(s);return}d(l.deleteVaultEntry)},onError:l=>{e(t=>t+1),r(k(l,"Failed to delete vault entry"))}})},[f]),R=c.useCallback(({kind:u,name:o,key:d,onCompleted:r,onError:l})=>{b({variables:{kind:u,name:o,key:d},onCompleted:(t,s)=>{const i=p(s,"Failed to reveal vault field");if(i){l(i);return}r(t.revealVaultSubfieldValue)},onError:t=>{l(k(t,"Failed to reveal vault field"))}})},[b]);return{entries:L,kinds:D,refresh:A,upsert:$,remove:C,revealSubfield:R,isUpserting:m,isDeleting:h}}const q={card:"Cards",login:"Logins",address:"Addresses",phone:"Phones",ssn:"Social Security numbers"},O={card:"Card",login:"Login",address:"Address",phone:"Phone",ssn:"Social Security number"},P={card:{number:"Card number",exp_m:"Expiry month",exp_y:"Expiry year",cvv:"CVV",zip:"Billing ZIP"},login:{username:"Username",password:"Password",[M]:"Authenticator setup key"},address:{line1:"Address line 1",line2:"Address line 2",city:"City",state:"State",zip:"ZIP",country:"Country"},phone:{number:"Phone number"},ssn:{full:"SSN"}},T={card:new Set(["number","cvv"]),login:new Set(["password",M]),ssn:new Set(["full"]),address:new Set,phone:new Set};function B(a,e){const n=P[a];return(n==null?void 0:n[e])??e}function z(a,e){var n;return((n=T[a])==null?void 0:n.has(e))??!1}export{q as K,M as L,O as a,z as i,B as s,Q as u};
