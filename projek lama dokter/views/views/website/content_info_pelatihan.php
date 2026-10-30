<div role="main" class="main">
    <!-- preloader section start -->
    <div class="loader-container">
        <span class="loader">
            <span class="loader-inner"></span>
        </span>
    </div>
    <section class="section section-height-3">
        <div class="container">
            <div class="row">

                <div class="appear-animation animated" data-appear-animation="fadeInUpShorter" data-appear-animation-delay="600" data-appear-animation-duration="700ms">

                    <?php if (empty($info_pelatihan)) {
                        echo '<h2>Belum ada informasi pelatihan.</h2>';
                    } else {
                        foreach ($info_pelatihan as $b) { ?>
                            <div class="col-lg-4 d-lg-flex flex-lg-column justify-content-lg-center px-4 mb-4 mb-lg-0 order-lg-2"></div>
                            <article class="blog-post mb-3">
                                <header class="blog-post-header mb-4 lightbox" data-plugin-options="{'delegate': 'a', 'type': 'image', 'gallery': {'enabled': true}}">
                                    <a class="lightbox" href="<?= base_url() ?>assets/img/info_pelatihan/<?= $b->gambar ?>">
                                        <span class="image-frame image-frame-style-1 image-frame-effect-1">
                                            <span class="image-frame-wrapper">

                                                <img cek-gambar="1" style="width: 100%;" src="<?= base_url() ?>assets/img/info_pelatihan/<?= $b->gambar ?>" class="lazyOwl img-fluid">

                                                <span class="image-frame-inner-border"></span>
                                                <span class="image-frame-action">
                                                    <span><i class="fas fa-search-plus text-color-light"></i></span>
                                                </span>
                                                <span class="thumb-info-title">
                                                    <span class="thumb-info-caption-text">

                                                    </span>
                                                </span>
                                            </span>
                                        </span>
                                    </a>
                                </header>
                                <h5 class="mb-2"><?= $b->judul ?></h5>
                                <div class="d-flex mb-3">
                                    <span class="post-date text-color-primary mr-1 pr-2">
                                        <?= date('d-m-Y', strtotime($b->tgl)) ?> </span>
                                </div>

                            </article>
                        <?php } ?>
                </div>
                <hr class="tall">
            <?php
                    } ?>
            <?php if (empty($pagination)) {
                echo "";
            } else { ?>

                <hr class="tall">
                <?= $pagination ?>

                <hr class="tall">
            <?php } ?>
            </div>


            <!-- main content -->

        </div>
    </section>

</div>