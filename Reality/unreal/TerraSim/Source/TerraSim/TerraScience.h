#pragma once
#include "CoreMinimal.h"
namespace TerraScience {
 constexpr double RadiusKm=6371.0088;
 constexpr double EquatorialCm=637813700.0;
 constexpr double Flattening=1.0/298.257223563;
 inline double Rad(double x){return x*PI/180.0;}
 inline double Deg(double x){return x*180.0/PI;}
 inline double Wrap(double x){return FMath::Fmod(FMath::Fmod(x+180.,360.)+360.,360.)-180.;}
 inline FVector Geo(double lat,double lon,double radius=EquatorialCm){return FVector(FMath::Cos(Rad(lat))*FMath::Cos(Rad(lon)),-FMath::Cos(Rad(lat))*FMath::Sin(Rad(lon)),FMath::Sin(Rad(lat)))*radius;}
 inline FVector2D Disc(double lat,double lon){double r=RadiusKm*Rad(90-lat);return FVector2D(r*FMath::Sin(Rad(lon)),r*FMath::Cos(Rad(lon)));}
 inline double Distance(double a,double b,double c,double d){double h=FMath::Square(FMath::Sin(Rad(c-a)/2))+FMath::Cos(Rad(a))*FMath::Cos(Rad(c))*FMath::Square(FMath::Sin(Rad(d-b)/2));return 2*RadiusKm*FMath::Asin(FMath::Sqrt(FMath::Clamp(h,0.,1.)));}
 // USNO low-precision solar coordinates. UTC is used as a UT1 approximation.
 inline FVector2D Sun(const FDateTime& t,double tilt=23.44){double days=(t-FDateTime(2000,1,1,12)).GetTotalDays();double g=Rad(FMath::Fmod(357.529+.98560028*days,360.));double L=Rad(FMath::Fmod(280.459+.98564736*days+1.915*FMath::Sin(g)+.020*FMath::Sin(2*g),360.));double dec=Deg(FMath::Asin(FMath::Sin(Rad(tilt))*FMath::Sin(L)));double ra=Deg(FMath::Atan2(FMath::Cos(Rad(tilt))*FMath::Sin(L),FMath::Cos(L)));double gst=280.46061837+360.98564736629*days;return FVector2D(dec,Wrap(ra-gst));}
 inline double Elevation(double lat,double lon,const FDateTime&t,bool flat,double sunHeight,double tilt=23.44){auto s=Sun(t,tilt);if(flat)return Deg(FMath::Atan2(sunHeight,(Disc(lat,lon)-Disc(s.X,s.Y)).Size()));return Deg(FMath::Asin(FMath::Clamp(FMath::Sin(Rad(lat))*FMath::Sin(Rad(s.X))+FMath::Cos(Rad(lat))*FMath::Cos(Rad(s.X))*FMath::Cos(Rad(lon-s.Y)),-1.,1.)));}
 inline double Daylight(double lat,const FDateTime&t,double tilt=23.44){double d=Rad(Sun(t,tilt).X),p=Rad(lat);double c=(FMath::Sin(Rad(-.833))-FMath::Sin(p)*FMath::Sin(d))/(FMath::Cos(p)*FMath::Cos(d));return c<=-1?24:c>=1?0:2*Deg(FMath::Acos(c))/15;}
 inline double Horizon(double h){return FMath::Sqrt(2*RadiusKm*h/1000.+FMath::Square(h/1000.));}
 inline double Hidden(double d,double h){double a=FMath::Max(0.,d/RadiusKm-FMath::Acos(RadiusKm/(RadiusKm+h/1000.)));return RadiusKm*(1/FMath::Cos(a)-1)*1000;}
 inline double Gravity(double lat,double h){double s=FMath::Sin(Rad(lat));return 9.7803253359*(1+.00193185265241*s*s)/FMath::Sqrt(1-.00669437999013*s*s)*FMath::Square(RadiusKm/(RadiusKm+h/1000.));}
}
