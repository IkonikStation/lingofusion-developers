const languageCodes = `aa,ab,ace,ach,ada,ady,ae,af,agq,ain,ak,akz,ale,alt,am,an,ang,anp,ar,arw,as,asa,ast,av,awa,ay,az,ba,bal,ban,bas,bax,bbc,bcc,be,bem,bez,bfd,bfn,bg,bgn,bho,bi,bik,bin,bla,bm,bn,bo,br,brx,bs,bss,bua,bug,byn,ca,ce,ceb,cgg,ch,chk,chm,cho,chp,chr,chy,ckb,co,cr,crh,cs,csb,cu,cv,cy,da,dak,dar,dav,de,del,den,dgr,din,dje,doi,dsb,dv,dyo,dz,ebu,ee,efi,eka,el,en,eo,es,et,eu,ewo,fa,fan,ff,fi,fil,fj,fo,fon,fr,frc,frp,frr,fur,fy,ga,gag,gan,gay,gba,gd,gez,gl,gn,goh,gon,gor,goth,grb,grc,gsw,gu,guz,gv,gwi,ha,haw,he,hi,hil,hmn,ho,hr,hsb,ht,hu,hup,hy,hz,ia,iba,ibb,id,ie,ig,ii,ik,ilo,inh,io,is,it,iu,ja,jbo,jgo,jmc,jv,ka,kab,kac,kaj,kam,kaw,kbd,kcg,kde,kea,kfo,kg,khq,ki,kj,kk,kkj,kl,kln,km,kmb,kn,ko,koi,kok,kos,kpe,kr,krc,krl,kru,ks,ksb,ksf,ksh,ku,kv,kw,ky,la,lad,lag,lah,lam,lb,lez,lg,li,lij,liv,lkt,lmo,ln,lo,lol,lrc,lt,lu,lua,lui,lun,luo,luy,lv,mad,mag,mai,mak,man,mas,mdf,men,mer,mfe,mg,mga,mgh,mgo,mi,mic,min,mk,ml,mn,mni,moh,mos,mr,ms,mt,mua,mul,mus,mwl,my,mzn,na,nap,naq,nb,nd,nds,ne,new,ng,nia,niu,nl,nmg,nn,nnh,no,nog,non,nqo,nr,nso,nus,nv,nwc,ny,nym,nyn,oc,oj,om,or,os,osa,ota,pa,pag,pal,pam,pap,pau,pcm,pdc,phn,pi,pl,pon,prg,pro,ps,pt,qu,quc,raj,rap,rar,rgn,rhg,rm,rn,ro,rof,rom,root,rtm,ru,rue,rug,rup,rw,rwk,sa,sad,sah,sam,saq,sas,sat,sba,sbp,sc,scn,sco,sd,sdh,se,see,seh,sel,sen,ser,sg,sga,sh,shi,shn,si,sid,sk,sl,sm,sma,smj,smn,sms,sn,snk,so,sog,sq,sr,srn,srr,ss,ssy,st,stq,su,suk,sus,sux,sv,sw,swb,syc,syr,ta,te,tem,teo,ter,tet,tg,th,ti,tig,tiv,tk,tkl,tlh,tli,tmh,tn,to,tog,tpi,tr,tru,trv,ts,tsd,tsi,tt,ttm,tum,tvl,tw,twq,ty,tyv,tzm,udm,ug,uga,uk,umb,und,ur,uz,vai,ve,vec,vep,vi,vls,vmf,vo,vot,vun,wa,wae,wal,war,was,wbp,wo,xh,xog,yao,yap,yav,ybb,yi,yo,yrl,yue,za,zap,zbl,zen,zgh,zh,zu,zun,zxx,zza`.split(",");

const displayNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "code" });

export const playgroundLanguages = languageCodes
  .flatMap((code) => {
    try {
      const name = displayNames.of(code);
      return name ? [{ code, name }] : [];
    } catch {
      return [];
    }
  })
  .filter((language, index, items) => items.findIndex((item) => item.name === language.name) === index)
  .sort((left, right) => left.name.localeCompare(right.name));
