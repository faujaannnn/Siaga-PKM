<!-- #template utama -->
<!--   hero area start   -->
<style>
	.link-terkait {
		border-radius: 3%;
		margin-bottom: 25px;
		margin-right: 25px
	}
</style>
<h1 role="heading" aria-level="1" data-uw-rm-heading="h1" style="clip: rect(1px, 1px, 1px, 1px)!important;height:1px!important;width:1px!important;overflow:hidden!important;position:absolute!important;top:0!important;left:0!important;z-index:-1!important;opacity:0!important" id="userway-h1-heading" data-uw-rm-ignore="">BKPP Kota Gorontalo</h1>
<!-- Slider main container -->
<div id="carouselExampleIndicators" class="carousel slide" data-ride="carousel">

	<ol class="carousel-indicators">
		<li data-target="#carouselExampleIndicators" data-slide-to="0" class="active"></li>
		<li data-target="#carouselExampleIndicators" data-slide-to="1"></li>
		<li data-target="#carouselExampleIndicators" data-slide-to="2"></li>
		<li data-target="#carouselExampleIndicators" data-slide-to="3"></li>
		<li data-target="#carouselExampleIndicators" data-slide-to="4"></li>
	</ol>
	<div class="carousel-inner">
		<div class="carousel-item active">
			<?php if (empty($bannerUtama)) {
				echo "";
			} else { ?>
				<img class="d-block w-100" src="<?= base_url() ?>assets/img/banner/<?= $bannerUtama['foto'] ?>">
			<?php } ?>
		</div>
		<?php foreach ($bannerkedua as $b): ?>
			<div class="carousel-item">
				<img class="d-block w-100" src="<?= base_url() ?>assets/img/banner/<?= $b->foto; ?>">
			</div>
		<?php endforeach; ?>
	</div>
	<a class="carousel-control-prev" href="#carouselExampleIndicators" role="button" data-slide="prev">
		<span class="carousel-control-prev-icon" aria-hidden="true"></span>
		<span class="sr-only">Previous</span>
	</a>
	<a class="carousel-control-next" href="#carouselExampleIndicators" role="button" data-slide="next">
		<span class="carousel-control-next-icon" aria-hidden="true"></span>
		<span class="sr-only">Next</span>
	</a>
</div>

<section class="section section-background section-height-1 overlay overlay-color-secondary overlay-show overlay-op-8">
	<div class="container">
		<div class="row">
			<div class="col-md-12">
				<h5 class="font-weight-semibold text-color-dark mb-0 word-rotator slide is-full-width">
					<span class="col-md-2">Pengumuman: </span>
					<span class="col-md-9 word-rotator-words" style="width: 832.5px;">
						<?php foreach ($pengumuman as $p => $item):
							if ($p == 0): ?>
								<b class="is-visible">
									<a href="<?= site_url('Home/baca_pengumuman/' . $item->id) ?>" class="text-dark"><?= htmlspecialchars($item->judul); ?></a>
								</b>
							<?php else: ?>
								<b class="is-hidden">
									<a href="<?= site_url('Home/baca_pengumuman/' . $item->id) ?>" class="text-dark"><?= htmlspecialchars($item->judul); ?></a>
								</b>
							<?php endif; ?>
						<?php endforeach; ?>
					</span>
				</h5>
			</div>
		</div>
	</div>
</section>

<section class="section section-height-2 bg-light-5 pb-5" id="terkini">
	<div class="container-fluid">
		<div class="row text-center">
			<div class="col">

			</div>
		</div>
	</div>
	<div class="container-fluid">
		<div class="row">
			<div class="col-10 col-sm-8 col-md-12 mx-auto d-flex overflow-hidden p-0 appear-animation animated" data-appear-animation="fadeInUpShorter" data-appear-animation-duration="700ms">
				<div class="owl-carousel carousel-center-active-items carousel-center-active-items-style-3 owl-theme owl-loaded owl-drag owl-carousel-init" data-plugin-carousel="" data-plugin-options="{'autoplay': true, 'dots': false, 'nav': true, 'loop': true, 'margin': 30, 'responsive': { '0': {'items': 1}, '576': {'items': 1}, '768': {'items': 3}, '992': {'items': 3}, '1200': {'items': 5}}}">
					<div class="owl-stage-outer">
						<div class="owl-stage" style="transform: translate3d(-2072px, 0px, 0px); transition: all 0.25s ease 0s; width: 7877px;">
							<?php foreach ($berita as $b): ?>
								<div class="owl-item" style="width: 384.574px; margin-right: 30px;" tabindex="-1" aria-hidden="true">
									<div class="appear-animation animated" data-appear-animation="fadeInLeftShorter" data-appear-animation-delay="400">
										<article class="card rounded border-0 p-0">
											<a cek-gambar="1" href="<?= site_url('Baseweb/baca_berita/' . $b->id) ?>" aria-label="Move to top" data-uw-rm-empty-ctrl=""><img src="<?= base_url() ?>assets/img/berita/<?= $b->gambar ?>" class="card-img-top hover-effect-2" style="height: 250px;" data-uw-rm-alt-original="" data-uw-rm-alt="CT"></a>
											<div class="card-body">
												<h3 class="font-weight-bold text-4 mb-1"><a href="<?= site_url('Base/baca_berita/' . $b->id) ?>" class="link-color-dark"><?= $b->judul; ?></a></h3>
												<span class="text-color-dark mb-3"><i class="far fa-clock text-color-primary"></i> <?= date('d-m-Y', strtotime($b->tgl)) ?></span>
											</div>
										</article>
									</div>
								</div>
							<?php endforeach; ?>
						</div>
					</div>
				</div>
				<div class="owl-nav">
					<button type="button" role="button" class="owl-prev" aria-label="Previous Slide" data-uw-rm-empty-ctrl="" data-uw-rm-kbnav="role" tabindex="0"></button>
					<button type="button" role="button" class="owl-next" aria-label="Next Slide" data-uw-rm-empty-ctrl="" data-uw-rm-kbnav="role" tabindex="0"></button>
				</div>
				<div class="owl-dots disabled"></div>
			</div>
		</div>
	</div>

	<div class="container">
		<div class="row text-center">
			<div class="col">
				<a href="<?= site_url('Baseweb/berita') ?>" class="btn btn-primary btn-rounded btn-4 text-0 font-weight-semibold">Indeks Berita</a>
			</div>
		</div>
	</div>
</section>

<section class="section bg-light-1">
	<div class="container">
		<div class="row">
			<?php foreach ($galeri as $g): ?>
				<div class="col-lg-4">
					<header class="blog-post-header mb-4 lightbox" data-plugin-options="{'delegate': 'a', 'type': 'image', 'gallery': {'enabled': true}}">
						<a class="lightbox" href="<?= base_url() ?>assets/img/foto/<?= $g->foto ?>">
							<span class="image-frame image-frame-style-1 image-frame-effect-1">
								<span class="image-frame-wrapper">

									<img cek-gambar="1" style="width: 100%;" src="<?= base_url() ?>assets/img/foto/<?= $g->foto ?>" class="lazyOwl img-fluid">

									<span class="image-frame-inner-border"></span>
									<span class="image-frame-action">
										<span><i class="fa fa-search-plus text-color-light"></i></span>
									</span>

								</span>
							</span>
						</a>

					</header>

				</div>
			<?php endforeach ?>
		</div>
	</div>
	<div class="container">
		<div class="row text-center">
			<div class="col">
				<a href="<?= site_url('Baseweb/galery') ?>" class="btn btn-primary btn-rounded btn-4 text-0 font-weight-semibold">Galeri Foto</a>
			</div>
		</div>
	</div>
</section>

<section class="section section-height-2 bg-light-5 pb-5">
	<div class="container-fluid">
		<div class="row text-center">
			<div class="col">

			</div>
		</div>
	</div>
	<div class="container-fluid">
		<div class="row">
			<div class="col-lg-3">
				<header class="blog-post-header mb-4 lightbox" data-plugin-options="{'delegate': 'a', 'type': 'image', 'gallery': {'enabled': true}}">
					<a class="lightbox" href="<?= base_url() ?>assets/img/infografis/infografis1.webp">
						<span class="image-frame image-frame-style-1 image-frame-effect-1">
							<span class="image-frame-wrapper">
								<img cek-gambar="1" style="width: 100%;" src="<?= base_url() ?>assets/img/infografis/infografis1.webp" class="lazyOwl img-fluid">
								<span class="image-frame-inner-border"></span>
								<span class="image-frame-action">
									<span><i class="fa fa-search-plus text-color-light"></i></span>
								</span>
							</span>
						</span>
					</a>
				</header>
			</div>
			<div class="col-lg-3">
				<header class="blog-post-header mb-3 lightbox" data-plugin-options="{'delegate': 'a', 'type': 'image', 'gallery': {'enabled': true}}">
					<a class="lightbox" href="<?= base_url() ?>assets/img/infografis/infografis2.webp">
						<span class="image-frame image-frame-style-1 image-frame-effect-1">
							<span class="image-frame-wrapper">
								<img cek-gambar="1" style="width: 100%;" src="<?= base_url() ?>assets/img/infografis/infografis2.webp" class="lazyOwl img-fluid">
								<span class="image-frame-inner-border"></span>
								<span class="image-frame-action">
									<span><i class="fa fa-search-plus text-color-light"></i></span>
								</span>
							</span>
						</span>
					</a>
				</header>
			</div>
			<div class="col-lg-3">
				<header class="blog-post-header mb-3 lightbox" data-plugin-options="{'delegate': 'a', 'type': 'image', 'gallery': {'enabled': true}}">
					<a class="lightbox" href="<?= base_url() ?>assets/img/infografis/infografis3.jpeg">
						<span class="image-frame image-frame-style-1 image-frame-effect-1">
							<span class="image-frame-wrapper">
								<img cek-gambar="1" style="width: 100%;" src="<?= base_url() ?>assets/img/infografis/infografis3.webp" class="lazyOwl img-fluid">
								<span class="image-frame-inner-border"></span>
								<span class="image-frame-action">
									<span><i class="fa fa-search-plus text-color-light"></i></span>
								</span>
							</span>
						</span>
					</a>
				</header>
			</div>
			<div class="col-lg-3">
				<header class="blog-post-header mb-3 lightbox" data-plugin-options="{'delegate': 'a', 'type': 'image', 'gallery': {'enabled': true}}">
					<a class="lightbox" href="<?= base_url() ?>assets/img/infografis/infografis4.webp">
						<span class="image-frame image-frame-style-1 image-frame-effect-1">
							<span class="image-frame-wrapper">
								<img cek-gambar="1" style="width: 100%;" src="<?= base_url() ?>assets/img/infografis/infografis4.webp" class="lazyOwl img-fluid">
								<span class="image-frame-inner-border"></span>
								<span class="image-frame-action">
									<span><i class="fa fa-search-plus text-color-light"></i></span>
								</span>
							</span>
						</span>
					</a>
				</header>
			</div>
		</div>
	</div>
	<p></p>
	<div class="container">
		<div class="row text-center">
			<div class="col">
				<a href="<?= site_url('Baseweb/berita') ?>" class="btn btn-primary btn-rounded btn-4 text-0 font-weight-semibold">Infografis</a>
			</div>
		</div>
	</div>
</section>

<!-- icons -->
<section class="section" style="background-color:darkorange">
	<div class="container-fluid text-center">
		<h1 style="font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; color:whitesmoke; padding-bottom: 10px;">LINK TERKAIT</h1>
	</div>
	<div class="container">

		<div class="row">
			<div class="col-lg-2 text-center bg-white link-terkait" style="">
				<a href="https://bnpb.go.id/" target="_blank" aria-label="Dinas Kesehatan Kota Palu - buka di tab baru" data-uw-rm-ext-link="" uw-rm-external-link-id="https://dinkes.palukota.go.id/">
					<div class="owl-item" style="padding-top: 5px;padding-bottom:5px">
						<img src="<?= base_url() ?>assets/img/logos/bnpb.png" class="img-fluid" width="100" alt="Dinkes Kota Palu" data-uw-rm-alt-original="DINKESKOTA" role="img" data-uw-rm-alt="ALT">
						<h2 class="top-sub-title text-color-primary d-block text-center"></h2>
					</div>
				</a>
			</div>
			<div class="col-lg-2 text-center bg-white link-terkait" style="">
				<a href="https://bpbd-sultengprov.com/" target="_blank" aria-label="Dinas Kesehatan Kota Palu - buka di tab baru" data-uw-rm-ext-link="" uw-rm-external-link-id="https://dinkes.palukota.go.id/">
					<div class="owl-item" style="padding-top: 5px;padding-bottom:5px">
						<img src="<?= base_url() ?>assets/img/logos/bpbdsulteng.png" class="img-fluid" width="100" alt="Dinkes Kota Palu" data-uw-rm-alt-original="DINKESKOTA" role="img" data-uw-rm-alt="ALT">
						<h2 class="top-sub-title text-color-primary d-block text-center"></h2>
					</div>
				</a>
			</div>
			<div class="col-lg-2 text-center bg-white link-terkait" style="">
				<a href="https://www.bmkg.go.id/" target="_blank" aria-label="Dinas Kesehatan Kota Palu - buka di tab baru" data-uw-rm-ext-link="" uw-rm-external-link-id="https://dinkes.palukota.go.id/">
					<div class="owl-item" style="padding-top: 5px;padding-bottom:5px">
						<img src="<?= base_url() ?>assets/img/logos/bmkg.png" class="img-fluid" width="100" alt="Dinkes Kota Palu" data-uw-rm-alt-original="DINKESKOTA" role="img" data-uw-rm-alt="ALT">
						<h2 class="top-sub-title text-color-primary d-block text-center"></h2>
					</div>
				</a>
			</div>
			<div class="col-lg-2 text-center bg-white link-terkait" style="">
				<a href="https://pusatkrisis.kemkes.go.id" target="_blank" aria-label="Dinas Kesehatan Kota Palu - buka di tab baru" data-uw-rm-ext-link="" uw-rm-external-link-id="https://dinkes.palukota.go.id/">
					<div class="owl-item" style="padding-top: 5px;padding-bottom:5px">
						<img src="<?= base_url() ?>assets/img/logos/puskris_menkes.png" class="img-fluid" width="100" alt="Dinkes Kota Palu" data-uw-rm-alt-original="DINKESKOTA" role="img" data-uw-rm-alt="ALT">
						<h2 class="top-sub-title text-color-primary d-block text-center"></h2>
					</div>
				</a>
			</div>
			<div class="col-lg-2 text-center bg-white link-terkait" style="">
				<a href="https://dinkes.sultengprov.go.id/" target="_blank" aria-label="Dinas Kesehatan Kota Palu - buka di tab baru" data-uw-rm-ext-link="" uw-rm-external-link-id="https://dinkes.palukota.go.id/">
					<div class="owl-item" style="padding-top: 5px;padding-bottom:5px">
						<img src="<?= base_url() ?>assets/img/logos/dinkesprovsulteng.png" class="img-fluid" width="100" alt="Dinkes Kota Palu" data-uw-rm-alt-original="DINKESKOTA" role="img" data-uw-rm-alt="ALT">
						<h2 class="top-sub-title text-color-primary d-block text-center"></h2>
					</div>
				</a>
			</div>
			<div class="col-lg-2 text-center bg-white link-terkait" style="">
				<a href="https://dinkes.palukota.go.id/" target="_blank" aria-label="Dinas Kesehatan Kota Palu - buka di tab baru" data-uw-rm-ext-link="" uw-rm-external-link-id="https://dinkes.palukota.go.id/">
					<div class="owl-item" style="padding-top: 5px;padding-bottom:5px">
						<img src="<?= base_url() ?>assets/img/logos/dinkeskotapalu.png" class="img-fluid" width="100" alt="Dinkes Kota Palu" data-uw-rm-alt-original="DINKESKOTA" role="img" data-uw-rm-alt="ALT">
						<h2 class="top-sub-title text-color-primary d-block text-center"></h2>
					</div>
				</a>
			</div>
			<div class="col-lg-2 text-center bg-white link-terkait" style="">
				<a href="https://untad.ac.id/" target="_blank" aria-label="Dinas Kesehatan Kota Palu - buka di tab baru" data-uw-rm-ext-link="" uw-rm-external-link-id="https://dinkes.palukota.go.id/">
					<div class="owl-item" style="padding-top: 5px;padding-bottom:5px">
						<img src="<?= base_url() ?>assets/img/logos/untad.png" class="img-fluid" width="100" alt="Dinkes Kota Palu" data-uw-rm-alt-original="DINKESKOTA" role="img" data-uw-rm-alt="ALT">
						<h2 class="top-sub-title text-color-primary d-block text-center"></h2>
					</div>
				</a>
			</div>
			<div class="col-lg-2 text-center bg-white link-terkait" style="">
				<a href="https://inarisk.bnpb.go.id/" target="_blank" aria-label="Dinas Kesehatan Kota Palu - buka di tab baru" data-uw-rm-ext-link="" uw-rm-external-link-id="https://dinkes.palukota.go.id/">
					<div class="owl-item" style="padding-top: 5px;padding-bottom:5px">
						<img src="<?= base_url() ?>assets/img/logos/logo_InaRISK_eng.png" class="img-fluid" width="100" alt="Dinkes Kota Palu" data-uw-rm-alt-original="DINKESKOTA" role="img" data-uw-rm-alt="ALT">
						<h2 class="top-sub-title text-color-primary d-block text-center"></h2>
					</div>
				</a>
			</div>
			<div class="col-lg-2 text-center bg-white link-terkait" style="">
				<a href="https://gis.bnpb.go.id/dev/map/" target="_blank" aria-label="Dinas Kesehatan Kota Palu - buka di tab baru" data-uw-rm-ext-link="" uw-rm-external-link-id="https://dinkes.palukota.go.id/">
					<div class="owl-item" style="padding-top: 5px;padding-bottom:5px">
						<img src="<?= base_url() ?>assets/img/logos/geoportal.png" class="img-fluid" width="100" alt="Dinkes Kota Palu" data-uw-rm-alt-original="DINKESKOTA" role="img" data-uw-rm-alt="ALT">
						<h2 class="top-sub-title text-color-primary d-block text-center"></h2>
					</div>
				</a>
			</div>
			<div class="col-lg-2 text-center bg-white link-terkait" style="">
				<a href="https://www.anri.go.id/" target="_blank" aria-label="Dinas Kesehatan Kota Palu - buka di tab baru" data-uw-rm-ext-link="" uw-rm-external-link-id="https://dinkes.palukota.go.id/">
					<div class="owl-item" style="padding-top: 5px;padding-bottom:5px">
						<img src="<?= base_url() ?>assets/img/logos/anri.png" class="img-fluid" width="100" alt="Dinkes Kota Palu" data-uw-rm-alt-original="DINKESKOTA" role="img" data-uw-rm-alt="ALT">
						<h2 class="top-sub-title text-color-primary d-block text-center"></h2>
					</div>
				</a>
			</div>

		</div>
	</div>
</section>
<!-- end of icons -->