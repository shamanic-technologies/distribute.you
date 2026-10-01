import{r as u,b as d,R as p}from"./app-DVKIbK40.js";const o=(function(){var e=[{defaultValue:null,kind:"LocalArgument",name:"step"}],n=[{alias:null,args:[{kind:"Variable",name:"step",variableName:"step"}],concreteType:"User",kind:"LinkedField",name:"setOnboardingStep",plural:!1,selections:[{alias:null,args:null,kind:"ScalarField",name:"id",storageKey:null},{alias:null,args:null,kind:"ScalarField",name:"onboardingStep",storageKey:null}],storageKey:null}];return{fragment:{argumentDefinitions:e,kind:"Fragment",metadata:null,name:"useSetOnboardingStepMutation",selections:n,type:"Mutation",abstractKey:null},kind:"Request",operation:{argumentDefinitions:e,kind:"Operation",name:"useSetOnboardingStepMutation",selections:n},params:{cacheID:"5e365969abd87f8014a5eb70bb86fec0",id:null,metadata:{},name:"useSetOnboardingStepMutation",operationKind:"mutation",text:`mutation useSetOnboardingStepMutation(
  $step: String
) {
  setOnboardingStep(step: $step) {
    id
    onboardingStep
  }
}
`}}})();o.hash="63ec200dcee4bda67510e7fa1c81eaa0";const g=o;function b(){const[e,n]=u.useMutation(g);return{setOnboardingStep:d.useCallback(({step:s,onCompleted:r,onError:a})=>{e({variables:{step:s},onCompleted:(t,l)=>{const i=p(l,"Failed to update onboarding step");if(i){a(i);return}r(t.setOnboardingStep)},onError:t=>{a(t.message)}})},[e]),isInFlight:n}}export{b as u};
